using Microsoft.Extensions.Configuration;
using Projects.Application;
namespace Projects.Infrastructure;

public sealed class LocalMediaStorage : IMediaStorage
{
    private readonly string root;
    public LocalMediaStorage(IConfiguration config) { root = Path.GetFullPath(config["Storage:Path"] ?? ".data/media"); Directory.CreateDirectory(root); }
    private string PathFor(string key)
    {
        if (Path.GetFileName(key) != key || !Guid.TryParseExact(Path.GetFileNameWithoutExtension(key), "N", out _) || !new[] { ".jpg", ".png", ".webp", ".mp4", ".webm" }.Contains(Path.GetExtension(key))) throw new AppException(400, "Invalid media key.");
        return Path.Combine(root, key);
    }
    public async Task<string> Save(Stream source, string extension, CancellationToken ct)
    {
        var key = Guid.NewGuid().ToString("N") + extension; var path = PathFor(key);
        try { await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, true); await source.CopyToAsync(file, ct); return key; }
        catch { File.Delete(path); throw; }
    }
    public Stream Open(string key) { var path = PathFor(key); if (!File.Exists(path)) throw new AppException(404, "Media file not found."); return new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, true); }
    public void Delete(string key) { File.Delete(PathFor(key)); }
}
