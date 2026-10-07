using System.Text.RegularExpressions;
namespace Projects.Application;

public static partial class ProjectRules
{
    public static readonly string[] Types = ["Backend", "Frontend web", "Frontend mobile", "Full stack web", "Full stack mobile", "Desktop", "CLI / tooling", "Game"];
    public static ProjectInput Validate(ProjectInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Title) || input.Title.Trim().Length > 120) throw new AppException(400, "Title must contain 1–120 characters.");
        if (input.Slug?.Length > 100 || !SlugPattern().IsMatch(input.Slug ?? "")) throw new AppException(400, "Slug must contain lowercase letters, numbers, and hyphens (max 100).");
        if (string.IsNullOrWhiteSpace(input.Summary) || input.Summary.Length > 300) throw new AppException(400, "Summary must contain 1–300 characters.");
        if (input.Description is null || input.Description.Length > 10000) throw new AppException(400, "Description is limited to 10,000 characters.");
        if (!Enum.IsDefined(input.Status)) throw new AppException(400, "Invalid project status.");
        if (input.SortOrder < 0 || input.SortOrder > 100000) throw new AppException(400, "Invalid sort order.");
        var stacks = CleanTags(input.Stacks); var clouds = CleanTags(input.Clouds); var types = CleanTags(input.Types);
        if (types.Length == 0 || types.Any(t => !Types.Contains(t, StringComparer.OrdinalIgnoreCase))) throw new AppException(400, "Select at least one supported project type.");
        var demo = SafeUrl(input.DemoUrl); var github = SafeUrl(input.GithubUrl); var website = SafeUrl(input.WebsiteUrl);
        if (input.EmbedDemo && demo is null) throw new AppException(400, "A demo URL is required for embedding.");
        return input with { Title = input.Title.Trim(), Summary = input.Summary.Trim(), Slug = input.Slug!.Trim(), DemoUrl = demo, GithubUrl = github, WebsiteUrl = website, Stacks = stacks, Clouds = clouds, Types = types };
    }
    public static string[] CleanTags(string[]? values)
    {
        if (values is null || values.Length > 20) throw new AppException(400, "Each category supports up to 20 tags.");
        if (values.Any(v => string.IsNullOrWhiteSpace(v) || v.Trim().Length > 50)) throw new AppException(400, "Tags must contain 1–50 characters.");
        return values.Select(v => v.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
    public static string? SafeUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (value.Length > 2048 || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo)) throw new AppException(400, "Links must be absolute HTTPS URLs without credentials.");
        return uri.AbsoluteUri;
    }
    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.NonBacktracking)] private static partial Regex SlugPattern();
}
