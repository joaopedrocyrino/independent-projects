namespace Projects.Domain;

public enum ProjectStatus { Draft, Published, Archived }
public enum TagCategory { Stack, Cloud, Type }
public enum MediaKind { Image, Video }
public sealed class PortfolioProject
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Description { get; set; } = "";
    public string? DemoUrl { get; set; }
    public string? GithubUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public bool EmbedDemo { get; set; }
    public bool Featured { get; set; }
    public int SortOrder { get; set; }
    public int Version { get; set; } = 1;
    public ProjectStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ProjectTag> Tags { get; set; } = [];
    public List<ProjectMedia> Media { get; set; } = [];
}
public sealed class Tag
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Key { get; set; } = "";
    public TagCategory Category { get; set; }
    public List<ProjectTag> Projects { get; set; } = [];
}
public sealed class ProjectTag
{
    public Guid ProjectId { get; set; }
    public PortfolioProject Project { get; set; } = null!;
    public Guid TagId { get; set; }
    public Tag Tag { get; set; } = null!;
}
public sealed class ProjectMedia
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public PortfolioProject Project { get; set; } = null!;
    public string StorageKey { get; set; } = "";
    public string OriginalName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string Caption { get; set; } = "";
    public MediaKind Kind { get; set; }
    public long Size { get; set; }
    public int SortOrder { get; set; }
    public bool IsCover { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class AdminAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public int FailedAttempts { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
}
public sealed class AdminSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AdminId { get; set; }
    public AdminAccount Admin { get; set; } = null!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}
