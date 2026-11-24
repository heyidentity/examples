package example;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
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
        Path root = Path.of("").toAbsolutePath();
        while (root != null && !Files.exists(root.resolve("CONTRACT.md"))) root = root.getParent();
        if (root == null) throw new IllegalStateException("Could not locate the examples repository root.");
        Map<String, String> settings = EnvFile.read(root.resolve(".env"));

        String authority = setting(settings, "OIDC_AUTHORITY");
        String clientId = setting(settings, "OIDC_CLIENT_ID");
        String port = setting(settings, "APP_PORT");
        List<String> missing = new ArrayList<>();
        if (authority.isEmpty()) missing.add("OIDC_AUTHORITY");
        if (clientId.isEmpty()) missing.add("OIDC_CLIENT_ID");

        SpringApplication app = new SpringApplication(ExampleApp.class);
        app.setDefaultProperties(Map.of(
            "server.address", "localhost",
            "server.port", port.isEmpty() ? "5173" : port,
            "example.authority", authority,
            "example.clientId", clientId,
            "example.missing", String.join(",", missing)
        ));
        if (missing.isEmpty()) app.setAdditionalProfiles("configured");
        app.run(args);
    }

    /** A process environment variable wins over .env; an empty value counts as missing (CONTRACT.md). */
    private static String setting(Map<String, String> settings, String name) {
        String environment = System.getenv(name);
        return (environment == null ? settings.getOrDefault(name, "") : environment).strip();
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, ObjectProvider<ClientRegistrationRepository> registrations) throws Exception {
        http.authorizeHttpRequests(requests -> requests.anyRequest().permitAll());
        ClientRegistrationRepository repository = registrations.getIfAvailable();
        if (repository != null) {
            var logout = new OidcClientInitiatedLogoutSuccessHandler(repository);
            logout.setPostLogoutRedirectUri("{baseUrl}/");
            http.oauth2Login(login -> login.defaultSuccessUrl("/", true)
                .failureHandler((request, response, failure) -> {
                    if (failure instanceof OAuth2AuthenticationException oauthFailure) {
                        var error = oauthFailure.getError();
                        String target = "/callback?error=" + URLEncoder.encode(error.getErrorCode(), StandardCharsets.UTF_8);
                        if (error.getDescription() != null && !error.getDescription().isBlank()) {
                            target += "&error_description=" + URLEncoder.encode(error.getDescription(), StandardCharsets.UTF_8);
                        }
                        response.sendRedirect(target);
                    } else {
                        response.sendRedirect("/callback?error=sign_in_failed");
                    }
                }));
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
