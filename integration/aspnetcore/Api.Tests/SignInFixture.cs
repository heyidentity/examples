using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HeyIdentity.Examples;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Playwright;
using Xunit;

[assembly: AssemblyFixture(typeof(SignInFixture))]

public sealed class SignInFixture : IAsyncLifetime
{
    private readonly HttpClient http = new(new SocketsHttpHandler { AllowAutoRedirect = false });
    internal string AdminAccessToken { get; private set; } = "";
    internal string AdminIdToken { get; private set; } = "";
    internal string ReaderAccessToken { get; private set; } = "";

    public async ValueTask InitializeAsync()
    {
        var settings = new ExampleSettings();
        var issuer = settings.Require("OIDC_AUTHORITY").TrimEnd('/');
        var clientId = settings.Require("OIDC_CLIENT_ID");
        var adminKey = settings.Require("ADMIN_USER_KEY");
        var readerKey = settings.Require("READER_USER_KEY");
        if (settings.Require("API_AUDIENCE") == clientId) throw settings.Invalid("API_AUDIENCE");
        if (!Uri.TryCreate(issuer, UriKind.Absolute, out var authority) ||
            (authority.Scheme != Uri.UriSchemeHttps && !(authority.IsLoopback && authority.Scheme == Uri.UriSchemeHttp)))
            throw settings.Invalid("OIDC_AUTHORITY");
        var redirect = $"http://localhost:{settings.Read("APP_PORT") ?? "5173"}/callback";

        using var discovery = JsonDocument.Parse(await http.GetStringAsync($"{issuer}/.well-known/openid-configuration"));
        if (discovery.RootElement.GetProperty("issuer").GetString() != issuer)
            throw new InvalidOperationException("Discovery returned an unexpected issuer.");
        var authorization = Endpoint("authorization_endpoint");
        var token = Endpoint("token_endpoint");
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new()
        {
            Channel = Environment.GetEnvironmentVariable("EXAMPLE_BROWSER_CHANNEL"),
        });

        (AdminAccessToken, AdminIdToken) = await SignInAsync(browser, authorization, token, clientId, redirect, adminKey);
        (ReaderAccessToken, _) = await SignInAsync(browser, authorization, token, clientId, redirect, readerKey);
        Console.WriteLine("Obtained tokens from two picker sign-ins.");

        string Endpoint(string name)
        {
            var endpoint = new Uri(discovery.RootElement.GetProperty(name).GetString()!);
            if (endpoint.GetLeftPart(UriPartial.Authority) != authority.GetLeftPart(UriPartial.Authority))
                throw new InvalidOperationException($"Unexpected discovery endpoint: {name}");
            return endpoint.AbsoluteUri;
        }
    }

    private async Task<(string AccessToken, string IdToken)> SignInAsync(
        IBrowser browser, string authorization, string token, string clientId, string redirect, string userKey)
    {
        var verifier = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var challenge = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var state = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(24));
        var request = QueryHelpers.AddQueryString(authorization, new Dictionary<string, string?>
        {
            ["client_id"] = clientId,
            ["response_type"] = "code",
            ["redirect_uri"] = redirect,
            ["scope"] = "openid profile",
            ["state"] = state,
            ["code_challenge"] = challenge,
            ["code_challenge_method"] = "S256",
        });
        await using var context = await browser.NewContextAsync();
        var page = await context.NewPageAsync();
        var callback = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        await page.RouteAsync(url => new Uri(url).GetLeftPart(UriPartial.Path) == redirect, async route =>
        {
            var query = QueryHelpers.ParseQuery(new Uri(route.Request.Url).Query);
            await route.FulfillAsync(new() { Status = 200, Body = "Callback received.", ContentType = "text/plain" });
            if (query.TryGetValue("state", out var returnedState) && returnedState.Count == 1 &&
                returnedState[0] == state && query.TryGetValue("code", out var codes) && codes.Count == 1 &&
                codes[0] is { Length: > 0 } authorizationCode)
                callback.TrySetResult(authorizationCode);
            else
                callback.TrySetException(new InvalidOperationException("The sign-in callback did not return the expected state and code."));
        });
        try
        {
            await page.GotoAsync(request);
            await page.GetByTestId($"authorize-btn-{userKey.ToLowerInvariant()}").ClickAsync();
        }
        catch (PlaywrightException)
        {
            throw new InvalidOperationException("The browser could not complete picker sign-in.");
        }
        var code = await callback.Task.WaitAsync(TimeSpan.FromSeconds(30));

        using var response = await http.PostAsync(token, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["client_id"] = clientId,
            ["code"] = code,
            ["redirect_uri"] = redirect,
            ["code_verifier"] = verifier,
        }));
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Token exchange failed with HTTP {(int)response.StatusCode}.");
        using var tokens = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (tokens.RootElement.GetProperty("access_token").GetString()!,
            tokens.RootElement.GetProperty("id_token").GetString()!);
    }

    public ValueTask DisposeAsync()
    {
        http.Dispose();
        return ValueTask.CompletedTask;
    }
}
