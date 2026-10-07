using Projects.Application;
using Projects.Domain;
namespace Projects.Tests;

public sealed class ProjectRulesTests
{
    private static ProjectInput Valid => new("Travel map", "travel-map", "Places worth remembering.", "Description", null, null, null, false, false, 0, ProjectStatus.Draft, [".NET", "React"], ["DigitalOcean"], ["Full stack web"]);
    [Fact] public void AcceptsOptionalLinks() { var p = ProjectRules.Validate(Valid); Assert.Null(p.DemoUrl); Assert.Equal("travel-map", p.Slug); }
    [Theory][InlineData("javascript:alert(1)")][InlineData("data:text/html,hello")][InlineData("http://example.com")][InlineData("https://user:password@example.com")] public void RejectsUnsafeLinks(string url) { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { DemoUrl = url })); }
    [Fact] public void AcceptsHttpsLinks() { Assert.Equal("https://example.com/demo", ProjectRules.Validate(Valid with { DemoUrl = "https://example.com/demo" }).DemoUrl); }
    [Theory][InlineData("../admin")][InlineData("My Project")][InlineData("-wrong")] public void RejectsUnsafeSlug(string slug) { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { Slug = slug })); }
    [Fact] public void RejectsLongSlug() { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { Slug = new string('a', 101) })); }
    [Fact] public void TagsAreTrimmedAndDeduplicated() { Assert.Equal(new[] { "React", ".NET" }, ProjectRules.Validate(Valid with { Stacks = [" React ", "react", ".NET"] }).Stacks); }
    [Fact] public void RequiresSupportedType() { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { Types = ["unknown"] })); Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { Types = [] })); }
    [Fact] public void EmbeddedDemoRequiresLink() { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { EmbedDemo = true })); }
    [Fact] public void RejectsInvalidEnum() { Assert.Throws<AppException>(() => ProjectRules.Validate(Valid with { Status = (ProjectStatus)9 })); }
    [Fact] public void AcceptsPngAndEnforcesImageLimit() { byte[] header = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]; Assert.Equal(MediaKind.Image, MediaRules.Inspect(header, "image/png", 100).Kind); Assert.Throws<AppException>(() => MediaRules.Inspect(header, "image/png", MediaRules.MaxImageBytes + 1)); }
    [Fact] public void RejectsMismatchAndHtml() { byte[] png = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]; Assert.Throws<AppException>(() => MediaRules.Inspect(png, "video/mp4", 100)); Assert.Throws<AppException>(() => MediaRules.Inspect("<html>hello!</html>"u8, "image/png", 100)); }
    [Fact] public void AcceptsMp4AndEnforcesVideoLimit() { byte[] mp4 = [0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]; Assert.Equal(MediaKind.Video, MediaRules.Inspect(mp4, "video/mp4", 100).Kind); Assert.Throws<AppException>(() => MediaRules.Inspect(mp4, "video/mp4", MediaRules.MaxVideoBytes + 1)); }
}
