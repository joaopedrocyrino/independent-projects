using Microsoft.EntityFrameworkCore;
using Projects.Domain;
namespace Projects.Infrastructure;

public sealed class ProjectsDbContext(DbContextOptions<ProjectsDbContext> options) : DbContext(options)
{
    public DbSet<PortfolioProject> Projects => Set<PortfolioProject>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<ProjectTag> ProjectTags => Set<ProjectTag>();
    public DbSet<ProjectMedia> Media => Set<ProjectMedia>();
    public DbSet<AdminAccount> Admins => Set<AdminAccount>();
    public DbSet<AdminSession> Sessions => Set<AdminSession>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<PortfolioProject>(e =>
        {
            e.HasIndex(p => p.Slug).IsUnique(); e.Property(p => p.Slug).HasMaxLength(100); e.Property(p => p.Title).HasMaxLength(120); e.Property(p => p.Summary).HasMaxLength(300); e.Property(p => p.Description).HasMaxLength(10000);
            e.Property(p => p.Status).HasConversion<string>().HasMaxLength(20); e.Property(p => p.Version).IsConcurrencyToken(); e.HasIndex(p => new { p.Status, p.Featured, p.SortOrder });
            e.ToTable(t => t.HasCheckConstraint("CK_Projects_Version", "\"Version\" > 0"));
        });
        b.Entity<Tag>(e => { e.Property(t => t.Name).HasMaxLength(50); e.Property(t => t.Key).HasMaxLength(50); e.Property(t => t.Category).HasConversion<string>().HasMaxLength(20); e.HasIndex(t => new { t.Category, t.Key }).IsUnique(); });
        b.Entity<ProjectTag>(e => { e.HasKey(t => new { t.ProjectId, t.TagId }); e.HasOne(t => t.Project).WithMany(p => p.Tags).HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade); e.HasOne(t => t.Tag).WithMany(t => t.Projects).HasForeignKey(t => t.TagId).OnDelete(DeleteBehavior.Cascade); });
        b.Entity<ProjectMedia>(e => { e.Property(m => m.Kind).HasConversion<string>().HasMaxLength(20); e.Property(m => m.StorageKey).HasMaxLength(80); e.Property(m => m.Caption).HasMaxLength(300); e.Property(m => m.OriginalName).HasMaxLength(255); e.HasIndex(m => m.StorageKey).IsUnique(); e.HasIndex(m => m.ProjectId).IsUnique().HasFilter("\"IsCover\" = TRUE"); e.HasOne(m => m.Project).WithMany(p => p.Media).HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade); e.ToTable(t => t.HasCheckConstraint("CK_Media_Size", "\"Size\" > 0")); });
        b.Entity<AdminAccount>(e => { e.Property(a => a.Email).HasMaxLength(254); e.HasIndex(a => a.Email).IsUnique(); });
        b.Entity<AdminSession>(e => { e.HasOne(s => s.Admin).WithMany().HasForeignKey(s => s.AdminId).OnDelete(DeleteBehavior.Cascade); e.HasIndex(s => s.ExpiresAt); });
    }
}
