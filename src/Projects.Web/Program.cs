using System.Net;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Projects.Domain;
using Projects.Application;
using Projects.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<ProjectsDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Configure ConnectionStrings__Database.")));
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddSingleton<IMediaStorage, LocalMediaStorage>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<FormOptions>(o => { o.MultipartBodyLengthLimit = MediaRules.MaxVideoBytes + 1048576; o.MemoryBufferThreshold = 65536; });
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = MediaRules.MaxVideoBytes + 1048576);
var keyPath = builder.Configuration["DataProtection:Path"] ?? ".data/keys";
Directory.CreateDirectory(keyPath);
builder.Services.AddDataProtection().SetApplicationName("projects-portfolio").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = builder.Environment.IsDevelopment() ? "projects.csrf.dev" : "__Host-projects-csrf"; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.Cookie.SameSite = SameSiteMode.Strict; });
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = builder.Environment.IsDevelopment() ? "projects.session.dev" : "__Host-projects-session";
    o.Cookie.HttpOnly = true; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.Cookie.SameSite = SameSiteMode.Strict;
    o.ExpireTimeSpan = TimeSpan.FromDays(15); o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    o.Events.OnValidatePrincipal = async ctx =>
    {
        var auth = ctx.HttpContext.RequestServices.GetRequiredService<AdminService>();
        if (!Guid.TryParse(ctx.Principal?.FindFirstValue("sid"), out var sid) || !await auth.IsValid(sid, ctx.HttpContext.RequestAborted)) { ctx.RejectPrincipal(); await ctx.HttpContext.SignOutAsync(); }
    };
});
builder.Services.AddAuthorization();
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (IPAddress.TryParse(builder.Configuration["Security:TrustedProxyIp"], out var proxy)) o.KnownProxies.Add(proxy);
});
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (ctx, ct) => { ctx.HttpContext.Response.Headers.RetryAfter = "60"; await ctx.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many requests. Try again shortly." }, ct); };
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx => RateLimitPartition.GetTokenBucketLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new TokenBucketRateLimiterOptions { TokenLimit = 180, TokensPerPeriod = 180, ReplenishmentPeriod = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("upload", ctx => RateLimitPartition.GetConcurrencyLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown", _ => new ConcurrencyLimiterOptions { PermitLimit = 2, QueueLimit = 0 }));
});
var app = builder.Build();
if (args.Contains("--migrate") || args.Contains("--seed-demo"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ProjectsDbContext>();
    await db.Database.MigrateAsync(); await scope.ServiceProvider.GetRequiredService<AdminService>().Bootstrap();
    if (args.Contains("--seed-demo")) await DemoSeed.Run(db, scope.ServiceProvider.GetRequiredService<IProjectService>());
    return;
}
app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers.XFrameOptions = "DENY";
    if (!app.Environment.IsDevelopment()) context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (AppException e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { message = e.Message }); }
    catch (BadHttpRequestException e) { context.Response.StatusCode = e.StatusCode; await context.Response.WriteAsJsonAsync(new { message = "Invalid or oversized request." }); }
    catch (Exception e) when (!context.RequestAborted.IsCancellationRequested) { app.Logger.LogError(e, "Request failed"); context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { message = "The request could not be completed." }); }
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
    {
        try { await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx); }
        catch (AntiforgeryValidationException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { message = "Security token expired. Refresh the page and try again." }); return; }
    }
    await next();
});
app.MapGet("/api/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/api/health/ready", async (ProjectsDbContext db, CancellationToken ct) =>
{
    try { await db.Projects.AsNoTracking().Select(p => p.Id).Take(1).ToListAsync(ct); return Results.Ok(new { status = "ready" }); }
    catch (Exception) { return Results.Json(new { status = "unavailable" }, statusCode: 503); }
});
app.MapGet("/api/auth/csrf", (HttpContext ctx, IAntiforgery csrf) => Results.Ok(new { token = csrf.GetAndStoreTokens(ctx).RequestToken }));
app.MapPost("/api/auth/login", async (LoginInput input, HttpContext ctx, AdminService auth, CancellationToken ct) =>
{
    var (admin, session) = await auth.Login(input, ct);
    var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()), new Claim(ClaimTypes.Email, admin.Email), new Claim("sid", session.Id.ToString())], CookieAuthenticationDefaults.AuthenticationScheme));
    await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, new AuthenticationProperties { IsPersistent = input.TrustDevice, ExpiresUtc = session.ExpiresAt });
    return Results.Ok(new { email = admin.Email });
}).RequireRateLimiting("login");
app.MapGet("/api/auth/me", (HttpContext ctx) => Results.Ok(new { email = ctx.User.FindFirstValue(ClaimTypes.Email) })).RequireAuthorization();
app.MapPost("/api/auth/logout", async (HttpContext ctx, AdminService auth, CancellationToken ct) =>
{
    await auth.Logout(Guid.Parse(ctx.User.FindFirstValue("sid")!), ct); await ctx.SignOutAsync(); return Results.NoContent();
}).RequireAuthorization();
app.MapPost("/api/auth/password", async (PasswordInput input, HttpContext ctx, AdminService auth, CancellationToken ct) =>
{
    await auth.ChangePassword(Guid.Parse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)!), Guid.Parse(ctx.User.FindFirstValue("sid")!), input, ct); return Results.NoContent();
}).RequireAuthorization().RequireRateLimiting("login");
app.MapGet("/api/projects", (string? q, string[]? stack, string[]? cloud, string[]? type, int? page, int? pageSize, IProjectService svc, CancellationToken ct) => svc.List(new(q, stack ?? [], cloud ?? [], type ?? [], page ?? 1, pageSize ?? 12), false, ct));
app.MapGet("/api/projects/{slug}", (string slug, IProjectService svc, CancellationToken ct) => svc.Get(slug, false, ct));
app.MapGet("/api/facets", (IProjectService svc, CancellationToken ct) => svc.Facets(ct));
app.MapGet("/api/project-types", () => ProjectRules.Types);
app.MapGet("/api/media/{id:guid}", async (Guid id, HttpContext ctx, IProjectService svc, CancellationToken ct) =>
{
    var media = await svc.ReadMedia(id, ctx.User.Identity?.IsAuthenticated == true, ct);
    return Results.File(media.Stream, media.ContentType, enableRangeProcessing: true);
});
var management = app.MapGroup("/api/admin").RequireAuthorization();
management.MapGet("/projects", (string? q, int? page, ProjectStatus? status, IProjectService svc, CancellationToken ct) => svc.List(new(q, [], [], [], page ?? 1, 50, status), true, ct));
management.MapGet("/projects/{id:guid}", (Guid id, IProjectService svc, CancellationToken ct) => svc.GetById(id, ct));
management.MapPost("/projects", async (ProjectInput input, IProjectService svc, CancellationToken ct) => { var p = await svc.Create(input, ct); return Results.Created($"/api/admin/projects/{p.Id}", p); });
management.MapPut("/projects/{id:guid}", (Guid id, ProjectInput input, IProjectService svc, CancellationToken ct) => svc.Update(id, input, ct));
management.MapDelete("/projects/{id:guid}", async (Guid id, int version, IProjectService svc, CancellationToken ct) => { await svc.Delete(id, version, ct); return Results.NoContent(); });
management.MapPost("/projects/{id:guid}/media", async (Guid id, HttpRequest request, IProjectService svc, CancellationToken ct) =>
{
    var form = await request.ReadFormAsync(ct); var file = form.Files.GetFile("file") ?? throw new AppException(400, "Choose a preview file.");
    await using var stream = file.OpenReadStream(); var media = await svc.Upload(id, stream, file.FileName, file.ContentType, file.Length, ct); return Results.Created(media.Url, media);
}).RequireRateLimiting("upload");
management.MapPut("/projects/{id:guid}/media/{mediaId:guid}", (Guid id, Guid mediaId, MediaInput input, IProjectService svc, CancellationToken ct) => svc.UpdateMedia(id, mediaId, input, ct));
management.MapDelete("/projects/{id:guid}/media/{mediaId:guid}", async (Guid id, Guid mediaId, IProjectService svc, CancellationToken ct) => { await svc.DeleteMedia(id, mediaId, ct); return Results.NoContent(); });
// Native development uses Vite. Docker/published builds include the React bundle.
var webRoot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (File.Exists(Path.Combine(webRoot, "index.html")))
{
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers.CacheControl = ctx.Context.Request.Path.StartsWithSegments("/assets") ? "public,max-age=31536000,immutable" : "no-cache";
        }
    });
    app.MapFallbackToFile("index.html");
}
app.Map("/api/{**path}", () => Results.NotFound(new { message = "API route not found." }));
await app.RunAsync();
