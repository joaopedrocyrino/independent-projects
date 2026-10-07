using Projects.Domain;
namespace Projects.Application;

public sealed record MediaFormat(string ContentType, string Extension, MediaKind Kind, long MaxBytes);
public static class MediaRules
{
    public const long MaxVideoBytes = 104857600;
    public const long MaxImageBytes = 20971520;
    public static MediaFormat Inspect(ReadOnlySpan<byte> header, string suppliedType, long size)
    {
        MediaFormat? format = null;
        if (header.Length >= 12)
        {
            if (header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff) format = new("image/jpeg", ".jpg", MediaKind.Image, MaxImageBytes);
            else if (header[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) format = new("image/png", ".png", MediaKind.Image, MaxImageBytes);
            else if (header[..4].SequenceEqual("RIFF"u8) && header.Slice(8, 4).SequenceEqual("WEBP"u8)) format = new("image/webp", ".webp", MediaKind.Image, MaxImageBytes);
            else if (header.Slice(4, 4).SequenceEqual("ftyp"u8) && (header.Slice(8, 4).SequenceEqual("isom"u8) || header.Slice(8, 4).SequenceEqual("mp42"u8) || header.Slice(8, 4).SequenceEqual("mp41"u8) || header.Slice(8, 4).SequenceEqual("avc1"u8) || header.Slice(8, 4).SequenceEqual("M4V "u8))) format = new("video/mp4", ".mp4", MediaKind.Video, MaxVideoBytes);
            else if (header[..4].SequenceEqual(new byte[] { 0x1a, 0x45, 0xdf, 0xa3 })) format = new("video/webm", ".webm", MediaKind.Video, MaxVideoBytes);
        }
        if (format is null || suppliedType != format.ContentType) throw new AppException(400, "Upload JPEG, PNG, WebP, MP4 or WebM with matching file content.");
        if (size <= 0 || size > format.MaxBytes) throw new AppException(400, format.Kind == MediaKind.Image ? "Images are limited to 20 MiB." : "Videos are limited to 100 MiB.");
        return format;
    }
}
