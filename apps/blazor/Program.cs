using System.Net;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Blazor;
using HeyIdentity.Examples;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Identity.Web;
using Microsoft.IdentityModel.Tokens;

var settings = new ExampleSettings();
var builder = WebApplication.CreateBuilder(args);
builder.Logging.SetMinimumLevel(LogLevel.Warning);
var port = settings.Read("APP_PORT") ?? "5173";
var origin = $"http://localhost:{port}/";
builder.WebHost.UseUrls(origin);
var required = new[] { "OIDC_AUTHORITY", "OIDC_CLIENT_ID", "ENTRA_INSTANCE", "ENTRA_TENANT_ID" };
var missing = required.Where(name => string.IsNullOrEmpty(settings.Read(name))).ToArray();
if (missing.Length > 0)
{
    var missingApp = builder.Build();
    var messages = string.Concat(missing.Select(name => $"<li>{WebUtility.HtmlEncode($"Missing setting: {name} in .env")}</li>"));
    missingApp.MapFallback(() => Results.Content($"<!doctype html><html lang=\"en\"><title>Missing settings</title><main><ul>{messages}</ul></main>", "text/html"));
    missingApp.Run();
    return;
}

var issuer = settings.Require("OIDC_AUTHORITY");
var instance = settings.Require("ENTRA_INSTANCE");
var tenantId = settings.Require("ENTRA_TENANT_ID");
if (!Uri.TryCreate(instance, UriKind.Absolute, out var instanceUri) ||
    instanceUri.AbsoluteUri != instanceUri.GetLeftPart(UriPartial.Authority) + "/" ||
    (instanceUri.Scheme != Uri.UriSchemeHttps && !(instanceUri.IsLoopback && instanceUri.Scheme == Uri.UriSchemeHttp)))
    throw settings.Invalid("ENTRA_INSTANCE");
if (!Guid.TryParse(tenantId, out _)) throw settings.Invalid("ENTRA_TENANT_ID");
if (new Uri(instanceUri, $"{tenantId}/v2.0").AbsoluteUri != issuer) throw settings.Invalid("OIDC_AUTHORITY");

builder.Configuration["AzureAd:Instance"] = instanceUri.AbsoluteUri;
builder.Configuration["AzureAd:TenantId"] = tenantId;
builder.Configuration["AzureAd:ClientId"] = settings.Require("OIDC_CLIENT_ID");
builder.Configuration["AzureAd:CallbackPath"] = "/signin-oidc";
builder.Services.AddAuthentication(OpenIdConnectDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApp(builder.Configuration.GetSection("AzureAd"));
builder.Services.Configure<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme, options =>
{
    options.ResponseType = "code";
    options.ResponseMode = "query";
    options.UsePkce = true;
    options.SaveTokens = true;
    options.RequireHttpsMetadata = instanceUri.Scheme == Uri.UriSchemeHttps;
    options.MapInboundClaims = false;
    options.TokenValidationParameters.NameClaimType = "name";
    options.TokenValidationParameters.RoleClaimType = "roles";
    options.Scope.Clear();
    options.Scope.Add("openid");
    options.Scope.Add("profile");
    options.Events.OnRemoteFailure = context =>
    {
        var failure = context.Failure;
        var code = System.Text.RegularExpressions.Regex.Match(failure?.Message ?? "", @"\bIDX\d{5}\b").Value;
        context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>()
            .LogWarning("OIDC callback failed ({Type}, {Code}).", failure?.GetType().Name, code);
        var error = context.Request.Query["error"].ToString();
        var description = context.Request.Query["error_description"].ToString();
        var parameters = new Dictionary<string, string?>
        {
            ["error"] = string.IsNullOrWhiteSpace(error) ? "sign_in_failed" : error,
        };
        if (!string.IsNullOrWhiteSpace(error) && !string.IsNullOrWhiteSpace(description))
            parameters["error_description"] = description;
        context.HandleResponse();
        context.Response.Redirect(QueryHelpers.AddQueryString("/callback", parameters));
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToIdentityProviderForSignOut = async context =>
    {
        context.ProtocolMessage.PostLogoutRedirectUri = origin;
        context.ProtocolMessage.IdTokenHint = await context.HttpContext.GetTokenAsync(
            CookieAuthenticationDefaults.AuthenticationScheme, "id_token");
        // The return goes to the app home, so it does not need a middleware callback or a logout state parameter.
        context.ProtocolMessage.State = null;
        context.Response.Redirect(context.ProtocolMessage.CreateLogoutRequestUrl());
        context.HandleResponse();
    };
});
builder.Services.PostConfigure<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme, options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters.RoleClaimType = "roles";
    var validate = options.Events.OnTokenValidated;
    options.Events.OnTokenValidated = async context =>
    {
        await validate(context);
        if (context.Result?.Failure is not null || context.Principal?.Identity is not ClaimsIdentity identity) return;
        // Use roles from the validated ID token even when a library maps the principal's claim names.
        // The token handler may expose a JSON array or one claim per role.
        foreach (var claim in context.SecurityToken.Claims.Where(claim => claim.Type == "roles"))
        {
            var roles = claim.ValueType == JsonClaimValueTypes.JsonArray
                ? JsonSerializer.Deserialize<string[]>(claim.Value) ?? []
                : [claim.Value];
            foreach (var role in roles)
            {
                if (!identity.HasClaim(identity.RoleClaimType, role))
                    identity.AddClaim(new Claim(identity.RoleClaimType, role));
            }
        }
    };
    // Microsoft.Identity.Web's Entra issuer validator uses its own HTTPS-only metadata retriever.
    // A disposable HTTP loopback provider uses an exact issuer comparison and still validates signature and audience.
    if (instanceUri.IsLoopback && instanceUri.Scheme == Uri.UriSchemeHttp)
    {
        options.TokenValidationParameters.IssuerValidatorUsingConfiguration = null;
        options.TokenValidationParameters.IssuerValidator = (incomingIssuer, _, _) =>
            incomingIssuer == issuer ? incomingIssuer : throw new SecurityTokenInvalidIssuerException("Unexpected loopback issuer.");
    }
});
builder.Services.AddAuthorization();
builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
builder.Services.AddRazorComponents();
builder.Services.AddCascadingAuthenticationState();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();
app.MapGet("/sign-in", () => Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }));
app.MapPost("/sign-out", async (HttpContext context, IAntiforgery antiforgery) =>
{
    if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
    return Results.SignOut(new AuthenticationProperties { RedirectUri = "/" },
        [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme]);
}).RequireAuthorization();
app.MapRazorComponents<App>();
app.Run();
