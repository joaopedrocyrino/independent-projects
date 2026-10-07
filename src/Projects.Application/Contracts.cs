using Projects.Domain;
namespace Projects.Application;

public sealed record TagDto(Guid Id, string Name, string Key, TagCategory Category, int Count = 0);
public sealed record MediaDto(Guid Id, MediaKind Kind, string Url, string Caption, string OriginalName, long Size, int SortOrder, bool IsCover);
public sealed record ProjectDto(Guid Id, string Slug, string Title, string Summary, string Description, string? DemoUrl, string? GithubUrl, string? WebsiteUrl, bool EmbedDemo, bool Featured, int SortOrder, ProjectStatus Status, int Version, DateTimeOffset UpdatedAt, List<TagDto> Tags, List<MediaDto> Media);
public sealed record PagedProjects(List<ProjectDto> Items, int Total, int Page, int PageSize);
public sealed record ProjectQuery(string? Search, string[] Stacks, string[] Clouds, string[] Types, int Page = 1, int PageSize = 12, ProjectStatus? Status = null);
public sealed record ProjectInput(string Title, string Slug, string Summary, string Description, string? DemoUrl, string? GithubUrl, string? WebsiteUrl, bool EmbedDemo, bool Featured, int SortOrder, ProjectStatus Status, string[] Stacks, string[] Clouds, string[] Types, int Version = 0);
public sealed record MediaInput(string Caption, int SortOrder, bool IsCover);
public sealed record LoginInput(string Email, string Password, bool TrustDevice);
public sealed record PasswordInput(string CurrentPassword, string NewPassword);
public sealed class AppException(int status, string message) : Exception(message) { public int Status { get; } = status; }
public interface IProjectService
{
    Task<PagedProjects> List(ProjectQuery query, bool admin, CancellationToken ct);
    Task<ProjectDto> Get(string slug, bool admin, CancellationToken ct);
    Task<ProjectDto> GetById(Guid id, CancellationToken ct);
    Task<List<TagDto>> Facets(CancellationToken ct);
    Task<ProjectDto> Create(ProjectInput input, CancellationToken ct);
    Task<ProjectDto> Update(Guid id, ProjectInput input, CancellationToken ct);
    Task Delete(Guid id, int version, CancellationToken ct);
    Task<MediaDto> Upload(Guid id, Stream stream, string filename, string contentType, long size, CancellationToken ct);
    Task<MediaDto> UpdateMedia(Guid id, Guid mediaId, MediaInput input, CancellationToken ct);
    Task DeleteMedia(Guid id, Guid mediaId, CancellationToken ct);
    Task<(Stream Stream, string ContentType, long Size)> ReadMedia(Guid mediaId, bool admin, CancellationToken ct);
}
public interface IMediaStorage
{
    Task<string> Save(Stream source, string extension, CancellationToken ct);
    Stream Open(string key);
    void Delete(string key);
}
