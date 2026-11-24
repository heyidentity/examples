package example;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@SpringBootApplication
@Controller
public class ExampleApp {
    public static void main(String[] args) throws IOException {
        Properties settings = new Properties();
        Path root = Path.of("").toAbsolutePath();
        while (root != null && !Files.exists(root.resolve("CONTRACT.md"))) root = root.getParent();
        if (root == null) throw new IllegalStateException("Could not locate the examples repository root.");
        Path path = root.resolve(".env");
        if (Files.isRegularFile(path)) {
            try (var reader = Files.newBufferedReader(path)) {
                settings.load(reader);
            }
        }

        String authority = setting(settings, "OIDC_AUTHORITY");
        String clientId = setting(settings, "OIDC_CLIENT_ID");
        String port = setting(settings, "APP_PORT");
        List<String> missing = new ArrayList<>();
        if (authority.isEmpty()) missing.add("OIDC_AUTHORITY");
        if (clientId.isEmpty()) missing.add("OIDC_CLIENT_ID");

        SpringApplication app = new SpringApplication(ExampleApp.class);
        app.setDefaultProperties(Map.of(
            "server.address", "127.0.0.1",
            "server.port", port.isEmpty() ? "5173" : port,
            "example.authority", authority,
            "example.clientId", clientId,
            "example.missing", String.join(",", missing)
        ));
        if (missing.isEmpty()) app.setAdditionalProfiles("configured");
        app.run(args);
    }

    private static String setting(Properties settings, String name) {
        String value = System.getenv(name);
        if (value == null) value = settings.getProperty(name, "");
        value = value.trim();
        if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, ObjectProvider<ClientRegistrationRepository> registrations) throws Exception {
        http.authorizeHttpRequests(requests -> requests.anyRequest().permitAll());
        ClientRegistrationRepository repository = registrations.getIfAvailable();
        if (repository != null) {
            var logout = new OidcClientInitiatedLogoutSuccessHandler(repository);
            logout.setPostLogoutRedirectUri("{baseUrl}/");
            http.oauth2Login(login -> login.defaultSuccessUrl("/", true)
                .failureHandler((request, response, failure) -> response.sendRedirect("/callback?error=sign_in_failed")));
            http.logout(options -> options.logoutSuccessHandler(logout));
        }
        return http.build();
    }

    private final List<String> missing;

    public ExampleApp(@Value("${example.missing:}") List<String> missing) {
        this.missing = missing;
    }

    @GetMapping("/")
    String home(@AuthenticationPrincipal OidcUser user, Model model) {
        identity(model, user);
        return "home";
    }

    @GetMapping("/admin")
    String admin(@AuthenticationPrincipal OidcUser user, Model model) {
        identity(model, user);
        List<String> roles = user == null ? null : user.getIdToken().getClaimAsStringList("roles");
        model.addAttribute("admin", roles != null && roles.contains("admin"));
        return "admin";
    }

    @GetMapping("/callback")
    String callback(@RequestParam(defaultValue = "sign_in_failed") String error,
                    @RequestParam(name = "error_description", defaultValue = "Sign-in could not be completed.") String description,
                    Model model) {
        model.addAttribute("missing", missing);
        model.addAttribute("message", error + ": " + description);
        return "callback";
    }

    private void identity(Model model, OidcUser user) {
        model.addAttribute("missing", missing);
        model.addAttribute("signedIn", user != null);
        model.addAttribute("name", user == null ? null : user.getFullName());
    }
}
