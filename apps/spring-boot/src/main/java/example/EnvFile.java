package example;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Reads the root .env with the settings grammar in CONTRACT.md: one NAME=value per line, comment lines start with #,
 * and a value is unquoted (cut at #) or wrapped in one pair of quotes without escapes.
 */
public final class EnvFile {
    private EnvFile() {
    }

    static Map<String, String> read(Path path) throws IOException {
        return Files.isRegularFile(path) ? parse(Files.readAllLines(path)) : Map.of();
    }

    static Map<String, String> parse(List<String> lines) {
        Map<String, String> settings = new TreeMap<>();
        for (String rawLine : lines) {
            String line = rawLine.strip();
            int equals = line.indexOf('=');
            if (line.isEmpty() || line.charAt(0) == '#' || equals <= 0) continue;
            String value = line.substring(equals + 1).strip();
            if (!value.isEmpty() && (value.charAt(0) == '"' || value.charAt(0) == '\'')) {
                int close = value.indexOf(value.charAt(0), 1);
                if (close > 0) value = value.substring(1, close);
            } else {
                int comment = value.indexOf('#');
                if (comment >= 0) value = value.substring(0, comment).stripTrailing();
            }
            settings.put(line.substring(0, equals).strip(), value);
        }
        return settings;
    }

    /** Prints the parsed file as a JSON object, for the offline grammar check (setup/compare-settings-grammar.mjs). */
    public static void main(String[] args) throws IOException {
        StringBuilder json = new StringBuilder("{");
        for (var entry : read(Path.of(args[0])).entrySet()) {
            if (json.length() > 1) json.append(',');
            json.append(quote(entry.getKey())).append(':').append(quote(entry.getValue()));
        }
        System.out.println(json.append('}'));
    }

    private static String quote(String text) {
        StringBuilder quoted = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            if (c == '"' || c == '\\') quoted.append('\\').append(c);
            else if (c < 0x20) quoted.append(String.format("\\u%04x", (int) c));
            else quoted.append(c);
        }
        return quoted.append('"').toString();
    }
}
