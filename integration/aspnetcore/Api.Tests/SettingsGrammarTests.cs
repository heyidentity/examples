using System.Text.Json;
using HeyIdentity.Examples;
using Xunit;

// Offline: pins the C# settings reader (shared by this example and apps/blazor) to the grammar in CONTRACT.md.
public sealed class SettingsGrammarTests
{
    [Fact]
    public void Reads_the_shared_grammar_fixture()
    {
        var setup = Path.Combine(RepositoryRoot(), "setup");
        var expected = JsonSerializer.Deserialize<Dictionary<string, string>>(
            File.ReadAllText(Path.Combine(setup, "settings-grammar.json")))!;
        var actual = ExampleSettings.Parse(File.ReadLines(Path.Combine(setup, "settings-grammar.env")));
        Assert.Equal(expected.OrderBy(entry => entry.Key), actual.OrderBy(entry => entry.Key));
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "CONTRACT.md")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Could not locate the examples repository root.");
    }
}
