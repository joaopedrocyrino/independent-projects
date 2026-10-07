using Microsoft.EntityFrameworkCore;
using Projects.Application;
using Projects.Domain;
using Npgsql;
namespace Projects.Infrastructure;

public sealed class ProjectService(ProjectsDbContext db, IMediaStorage storage) : IProjectService
{
    private IQueryable<PortfolioProject> Graph => db.Projects.Include(p => p.Tags).ThenInclude(t => t.Tag).Include(p => p.Media);
    private static MediaDto MediaDto(ProjectMedia m) => new(m.Id, m.Kind, $"/api/media/{m.Id}", m.Caption, m.OriginalName, m.Size, m.SortOrder, m.IsCover);
    private static ProjectDto Dto(PortfolioProject p) => new(p.Id, p.Slug, p.Title, p.Summary, p.Description, p.DemoUrl, p.GithubUrl, p.WebsiteUrl, p.EmbedDemo, p.Featured, p.SortOrder, p.Status, p.Version, p.UpdatedAt, p.Tags.OrderBy(t => t.Tag.Name).Select(t => new TagDto(t.Tag.Id, t.Tag.Name, t.Tag.Key, t.Tag.Category)).ToList(), p.Media.OrderByDescending(m => m.IsCover).ThenBy(m => m.SortOrder).ThenBy(m => m.CreatedAt).Select(MediaDto).ToList());
    public async Task<PagedProjects> List(ProjectQuery query, bool admin, CancellationToken ct)
    {
        if (query.Page < 1 || query.Page > 100000 || query.PageSize < 1 || query.PageSize > 50) throw new AppException(400, "Invalid pagination.");
        var projects = Graph.AsNoTracking().AsSplitQuery(); if (!admin) projects = projects.Where(p => p.Status == ProjectStatus.Published); else if (query.Status is not null) projects = projects.Where(p => p.Status == query.Status);
        var search = query.Search?.Trim().ToLowerInvariant(); if (search?.Length > 200) throw new AppException(400, "Search is too long.");
        if (!string.IsNullOrEmpty(search)) projects = projects.Where(p => p.Title.ToLower().Contains(search) || p.Summary.ToLower().Contains(search));
        var stacks = Keys(query.Stacks); var clouds = Keys(query.Clouds); var types = Keys(query.Types);
        if (stacks.Length > 0) projects = projects.Where(p => p.Tags.Any(t => t.Tag.Category == TagCategory.Stack && stacks.Contains(t.Tag.Key)));
        if (clouds.Length > 0) projects = projects.Where(p => p.Tags.Any(t => t.Tag.Category == TagCategory.Cloud && clouds.Contains(t.Tag.Key)));
        if (types.Length > 0) projects = projects.Where(p => p.Tags.Any(t => t.Tag.Category == TagCategory.Type && types.Contains(t.Tag.Key)));
        var total = await projects.CountAsync(ct);
        var items = await projects.OrderByDescending(p => p.Featured).ThenBy(p => p.SortOrder).ThenByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        return new(items.Select(Dto).ToList(), total, query.Page, query.PageSize);
    }
    private static string[] Keys(string[]? values) { if (values is null) return []; if (values.Length > 20 || values.Any(v => v.Length > 50)) throw new AppException(400, "Invalid filters."); return values.Select(v => v.Trim().ToLowerInvariant()).Where(v => v.Length > 0).Distinct().ToArray(); }
    public async Task<ProjectDto> Get(string slug, bool admin, CancellationToken ct) { var p = await Graph.AsNoTracking().AsSplitQuery().FirstOrDefaultAsync(p => p.Slug == slug && (admin || p.Status == ProjectStatus.Published), ct); return p is null ? throw new AppException(404, "Project not found.") : Dto(p); }
    public async Task<ProjectDto> GetById(Guid id, CancellationToken ct) { var p = await Graph.AsNoTracking().AsSplitQuery().FirstOrDefaultAsync(p => p.Id == id, ct); return p is null ? throw new AppException(404, "Project not found.") : Dto(p); }
    public async Task<List<TagDto>> Facets(CancellationToken ct) { return await db.Tags.AsNoTracking().Where(t => t.Projects.Any(p => p.Project.Status == ProjectStatus.Published)).OrderBy(t => t.Name).Select(t => new TagDto(t.Id, t.Name, t.Key, t.Category, t.Projects.Count(p => p.Project.Status == ProjectStatus.Published))).ToListAsync(ct); }
    private static void Apply(PortfolioProject p, ProjectInput i) { p.Title = i.Title; p.Slug = i.Slug; p.Summary = i.Summary; p.Description = i.Description; p.DemoUrl = i.DemoUrl; p.GithubUrl = i.GithubUrl; p.WebsiteUrl = i.WebsiteUrl; p.EmbedDemo = i.EmbedDemo; p.Featured = i.Featured; p.SortOrder = i.SortOrder; p.Status = i.Status; p.UpdatedAt = DateTimeOffset.UtcNow; }
    private async Task SetTags(PortfolioProject p, ProjectInput i, CancellationToken ct)
    {
        var desired = new List<Tag>();
        foreach (var (category, names) in new[] { (TagCategory.Stack, i.Stacks), (TagCategory.Cloud, i.Clouds), (TagCategory.Type, i.Types) })
            foreach (var name in names)
            {
                var key = name.ToLowerInvariant();
                var tag = await db.Tags.FirstOrDefaultAsync(t => t.Category == category && t.Key == key, ct);
                if (tag is null) { tag = new Tag { Name = name, Key = key, Category = category }; db.Tags.Add(tag); }
                desired.Add(tag);
            }
        var target = desired.Select(t => t.Id).ToHashSet();
        foreach (var old in p.Tags.Where(t => !target.Contains(t.TagId)).ToList()) { db.ProjectTags.Remove(old); p.Tags.Remove(old); }
        foreach (var tag in desired.Where(tag => p.Tags.All(t => t.TagId != tag.Id))) p.Tags.Add(new ProjectTag { Project = p, Tag = tag, ProjectId = p.Id, TagId = tag.Id });

    }
    private async Task Save(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new AppException(409, "This project changed. Reload before saving."); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException pg && pg.SqlState == PostgresErrorCodes.UniqueViolation) { throw new AppException(409, "This slug or tag already exists. Reload and try again."); }
    }
    public async Task<ProjectDto> Create(ProjectInput input, CancellationToken ct) { var i = ProjectRules.Validate(input); await using var transaction = await db.Database.BeginTransactionAsync(ct); var p = new PortfolioProject(); Apply(p, i); db.Projects.Add(p); await SetTags(p, i, ct); await Save(ct); await transaction.CommitAsync(ct); return Dto(p); }
    public async Task<ProjectDto> Update(Guid id, ProjectInput input, CancellationToken ct)
    {
        var i = ProjectRules.Validate(input); await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var p = await Graph.AsSplitQuery().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new AppException(404, "Project not found.");
        if (p.Version != i.Version) throw new AppException(409, "This project changed. Reload before saving."); Apply(p, i); p.Version++; await SetTags(p, i, ct); await Save(ct); await transaction.CommitAsync(ct); return Dto(p);
    }
    public async Task Delete(Guid id, int version, CancellationToken ct)
    {
        var p = await Graph.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new AppException(404, "Project not found."); if (p.Version != version) throw new AppException(409, "Reload this project before deleting.");
        var keys = p.Media.Select(m => m.StorageKey).ToList(); db.Projects.Remove(p); await Save(ct); foreach (var key in keys) storage.Delete(key);
    }
    public async Task<MediaDto> Upload(Guid id, Stream stream, string filename, string contentType, long size, CancellationToken ct)
    {
        // Lock this project so concurrent uploads cannot bypass its media quota or cover uniqueness.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Projects\" WHERE \"Id\" = {id} FOR UPDATE", ct);
        var project = await db.Projects.Include(p => p.Media).FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new AppException(404, "Project not found.");
        if (project.Media.Count >= 20 || project.Media.Sum(m => m.Size) + size > 1073741824L) throw new AppException(400, "A project supports 20 previews and up to 1 GiB of media.");
        var header = new byte[32]; var bytes = await stream.ReadAtLeastAsync(header, 12, false, ct); var format = MediaRules.Inspect(header.AsSpan(0, bytes), contentType, size);
        if (!stream.CanSeek) throw new AppException(400, "Upload stream must be seekable."); stream.Position = 0;
        var key = await storage.Save(stream, format.Extension, ct);
        var media = new ProjectMedia { ProjectId = id, StorageKey = key, OriginalName = Path.GetFileName(filename)[..Math.Min(Path.GetFileName(filename).Length, 255)], ContentType = format.ContentType, Kind = format.Kind, Size = size, SortOrder = project.Media.Count, IsCover = project.Media.Count == 0 };
        try { db.Media.Add(media); project.UpdatedAt = DateTimeOffset.UtcNow; project.Version++; await Save(ct); await transaction.CommitAsync(ct); return MediaDto(media); } catch { storage.Delete(key); throw; }
    }
    public async Task<MediaDto> UpdateMedia(Guid id, Guid mediaId, MediaInput input, CancellationToken ct)
    {
        if (input.Caption.Length > 300 || input.SortOrder < 0 || input.SortOrder > 100000) throw new AppException(400, "Invalid caption or order.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Projects\" WHERE \"Id\" = {id} FOR UPDATE", ct);
        var media = await db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.ProjectId == id, ct) ?? throw new AppException(404, "Media not found.");
        if (input.IsCover) await db.Media.Where(m => m.ProjectId == id && m.Id != mediaId && m.IsCover).ExecuteUpdateAsync(s => s.SetProperty(m => m.IsCover, false), ct);
        media.Caption = input.Caption.Trim(); media.SortOrder = input.SortOrder; media.IsCover = input.IsCover;
        await db.Projects.Where(p => p.Id == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.Version, p => p.Version + 1).SetProperty(p => p.UpdatedAt, DateTimeOffset.UtcNow), ct);
        await Save(ct); await transaction.CommitAsync(ct); return MediaDto(media);
    }
    public async Task DeleteMedia(Guid id, Guid mediaId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Projects\" WHERE \"Id\" = {id} FOR UPDATE", ct);
        var media = await db.Media.FirstOrDefaultAsync(m => m.Id == mediaId && m.ProjectId == id, ct) ?? throw new AppException(404, "Media not found.");
        db.Media.Remove(media); await Save(ct);
        if (media.IsCover) { var next = await db.Media.Where(m => m.ProjectId == id).OrderBy(m => m.SortOrder).FirstOrDefaultAsync(ct); if (next is not null) { next.IsCover = true; await Save(ct); } }
        await db.Projects.Where(p => p.Id == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.Version, p => p.Version + 1).SetProperty(p => p.UpdatedAt, DateTimeOffset.UtcNow), ct);
        await transaction.CommitAsync(ct); storage.Delete(media.StorageKey);
    }
    public async Task<(Stream Stream, string ContentType, long Size)> ReadMedia(Guid mediaId, bool admin, CancellationToken ct)
    {
        var media = await db.Media.AsNoTracking().FirstOrDefaultAsync(m => m.Id == mediaId && (admin || m.Project.Status == ProjectStatus.Published), ct) ?? throw new AppException(404, "Media not found.");
        return (storage.Open(media.StorageKey), media.ContentType, media.Size);
    }
}
