using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Projects.Application;
using Projects.Domain;
namespace Projects.Infrastructure;

public sealed class AdminService(ProjectsDbContext db, IConfiguration config)
{
    private static readonly PasswordHasher<AdminAccount> Hasher = new();
    private static readonly AdminAccount Dummy = new();
    private static readonly string DummyHash = Hasher.HashPassword(Dummy, Guid.NewGuid().ToString());
    public async Task Bootstrap(CancellationToken ct = default)
    {
        if (await db.Admins.AnyAsync(ct)) return;
        var email = config["Admin:Email"]?.Trim().ToLowerInvariant(); var password = config["Admin:Password"];
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 || !email.Contains('@') || password is null || password.Length < 16) throw new InvalidOperationException("Set Admin__Email and a generated Admin__Password (at least 16 characters). Bootstrap never overwrites an account.");
        var admin = new AdminAccount { Email = email }; admin.PasswordHash = Hasher.HashPassword(admin, password); db.Admins.Add(admin); await db.SaveChangesAsync(ct);
    }
    public async Task<(AdminAccount Admin, AdminSession Session)> Login(LoginInput input, CancellationToken ct)
    {
        if (input.Email is null || input.Password is null || input.Email.Length > 254 || input.Password.Length > 512) throw new AppException(400, "Invalid credentials.");
        var admin = await db.Admins.FirstOrDefaultAsync(a => a.Email == input.Email.Trim().ToLowerInvariant(), ct);
        var now = DateTimeOffset.UtcNow;
        var result = Hasher.VerifyHashedPassword(admin ?? Dummy, admin?.PasswordHash ?? DummyHash, input.Password);
        if (admin is null || result == PasswordVerificationResult.Failed || admin.LockedUntil > now)
        {
            if (admin is not null && admin.LockedUntil <= now) { admin.FailedAttempts++; if (admin.FailedAttempts >= 5) { admin.LockedUntil = now.AddMinutes(15); admin.FailedAttempts = 0; } await db.SaveChangesAsync(ct); }
            else if (admin is not null && admin.LockedUntil is null) { admin.FailedAttempts++; if (admin.FailedAttempts >= 5) { admin.LockedUntil = now.AddMinutes(15); admin.FailedAttempts = 0; } await db.SaveChangesAsync(ct); }
            throw new AppException(401, "Invalid credentials or temporarily locked account.");
        }
        admin.FailedAttempts = 0; admin.LockedUntil = null;
        if (result == PasswordVerificationResult.SuccessRehashNeeded) admin.PasswordHash = Hasher.HashPassword(admin, input.Password);
        var session = new AdminSession { AdminId = admin.Id, ExpiresAt = now.AddDays(input.TrustDevice ? 15 : 1) }; db.Sessions.Add(session);
        await db.Sessions.Where(s => s.ExpiresAt < now.AddDays(-1)).ExecuteDeleteAsync(ct);
        await db.SaveChangesAsync(ct); return (admin, session);
    }
    public Task<bool> IsValid(Guid sessionId, CancellationToken ct) => db.Sessions.AsNoTracking().AnyAsync(s => s.Id == sessionId && s.RevokedAt == null && s.ExpiresAt > DateTimeOffset.UtcNow, ct);
    public async Task Logout(Guid sessionId, CancellationToken ct) => await db.Sessions.Where(s => s.Id == sessionId).ExecuteUpdateAsync(s => s.SetProperty(v => v.RevokedAt, DateTimeOffset.UtcNow), ct);
    public async Task ChangePassword(Guid adminId, Guid sessionId, PasswordInput input, CancellationToken ct)
    {
        if (input.NewPassword is null || input.NewPassword.Length < 16 || input.NewPassword.Length > 512) throw new AppException(400, "Use a password with 16–512 characters.");
        var admin = await db.Admins.FirstAsync(a => a.Id == adminId, ct);
        if (Hasher.VerifyHashedPassword(admin, admin.PasswordHash, input.CurrentPassword ?? "") == PasswordVerificationResult.Failed) throw new AppException(400, "Current password is incorrect.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        admin.PasswordHash = Hasher.HashPassword(admin, input.NewPassword); await db.SaveChangesAsync(ct);
        await db.Sessions.Where(s => s.AdminId == adminId && s.Id != sessionId && s.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(v => v.RevokedAt, DateTimeOffset.UtcNow), ct);
        await transaction.CommitAsync(ct);
    }
}
