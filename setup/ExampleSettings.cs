using System.Text.Json;

namespace HeyIdentity.Examples;

internal sealed class ExampleSettings
{
    private readonly Dictionary<string, string> fileSettings = new(StringComparer.Ordinal);
    private readonly string path;

    public ExampleSettings()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "CONTRACT.md")))
        {
            directory = directory.Parent;
        }
        if (directory is null) throw new InvalidOperationException("Could not locate the examples repository root.");
        path = Path.Combine(directory.FullName, ".env");
        if (!File.Exists(path)) return;
        foreach (var rawLine in File.ReadLines(path))
        {
            var line = rawLine.Trim();
            var equals = line.IndexOf('=');
            if (line.StartsWith('#') || equals <= 0) continue;
            var value = line[(equals + 1)..].Trim();
            if (value.StartsWith('"') && value.EndsWith('"'))
            {
                value = JsonSerializer.Deserialize<string>(value) ?? "";
            }
            else if (value.StartsWith('\'') && value.EndsWith('\''))
            {
                value = value[1..^1];
            }
            else
            {
                value = value.Split('#', 2)[0].TrimEnd();
            }
            fileSettings[line[..equals].Trim()] = value;
        }
    }

    public string? Read(string name) =>
        (Environment.GetEnvironmentVariable(name) ?? fileSettings.GetValueOrDefault(name))?.Trim();

    public string Require(string name) => Read(name) is { Length: > 0 } value
        ? value
        : throw new InvalidOperationException($"Missing setting: {name} in {path}");

    public InvalidOperationException Invalid(string name) => new($"Invalid setting: {name} in {path}");
}
