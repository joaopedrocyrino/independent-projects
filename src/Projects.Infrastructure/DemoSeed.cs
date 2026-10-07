using Microsoft.EntityFrameworkCore;
using Projects.Application;
using Projects.Domain;
namespace Projects.Infrastructure;

public static class DemoSeed
{
    public static async Task Run(ProjectsDbContext db, IProjectService service)
    {
        // Opt-in example data only. This command never replaces existing projects.
        if (await db.Projects.AnyAsync()) return;
        var examples = new[]{
   ("Travel atlas","travel-atlas","A personal map of places, stories, and moments worth keeping.",new[]{".NET","React","PostgreSQL"},new[]{"DigitalOcean"},"Full stack web"),
   ("Studio desk","studio-desk","A calm workspace for a busy creative studio. Bookings, clients, and a little less chaos.",new[]{"NestJS","React","Node.js"},new[]{"AWS"},"Full stack web"),
   ("Pocket trails","pocket-trails","Small adventures, right in your pocket. An offline-friendly travel companion.",new[]{"React Native","TypeScript"},new[]{"AWS"},"Frontend mobile")};
        foreach (var (title, slug, summary, stacks, clouds, type) in examples) await service.Create(new(title, slug, summary, "Example project for exploring the portfolio. Replace this with your own project, screenshots, and links.", null, null, null, false, true, 0, ProjectStatus.Published, stacks, clouds, [type]), default);
    }
}
