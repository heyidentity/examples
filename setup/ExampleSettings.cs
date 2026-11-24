namespace HeyIdentity.Examples;

/// <summary>
/// Reads the root <c>.env</c> with the settings grammar in CONTRACT.md: one <c>NAME=value</c> per line, comment lines
/// start with <c>#</c>, and a value is unquoted (cut at <c>#</c>) or wrapped in one pair of quotes without escapes.
/// A process environment variable wins over the file, and an empty value counts as missing.
/// </summary>
internal sealed class ExampleSettings
{
    private readonly IReadOnlyDictionary<string, string> fileSettings;
    private readonly string path;

    public ExampleSettings() : this(FindSettingsFile())
    {
    }

    public ExampleSettings(string path)
    {
        this.path = path;
        fileSettings = File.Exists(path) ? Parse(File.ReadLines(path)) : new Dictionary<string, string>();
    }

    internal static Dictionary<string, string> Parse(IEnumerable<string> lines)
    {
        var settings = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            var equals = line.IndexOf('=');
            if (line.Length == 0 || line[0] == '#' || equals <= 0) continue;
            var value = line[(equals + 1)..].Trim();
            if (value.Length > 0 && value[0] is '"' or '\'')
            {
                var close = value.IndexOf(value[0], 1);
                value = close > 0 ? value[1..close] : value;
            }
            else
            {
                value = value.Split('#', 2)[0].TrimEnd();
            }
            settings[line[..equals].Trim()] = value;
        }
        return settings;
    }

    public string? Read(string name)
    {
        var value = (Environment.GetEnvironmentVariable(name) ?? fileSettings.GetValueOrDefault(name))?.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
    }

    public string Require(string name) => Read(name)
        ?? throw new InvalidOperationException($"Missing setting: {name} in {path}");

    public InvalidOperationException Invalid(string name) => new($"Invalid setting: {name} in {path}");

    private static string FindSettingsFile()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "CONTRACT.md")))
        {
            directory = directory.Parent;
        }
        if (directory is null) throw new InvalidOperationException("Could not locate the examples repository root.");
        return Path.Combine(directory.FullName, ".env");
    }
}
