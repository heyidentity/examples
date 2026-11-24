using HeyIdentity.Examples;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var settings = new ExampleSettings();
var issuer = settings.Require("OIDC_AUTHORITY").TrimEnd('/');
var clientId = settings.Require("OIDC_CLIENT_ID");
var audience = settings.Require("API_AUDIENCE");
if (string.Equals(audience, clientId, StringComparison.Ordinal)) throw settings.Invalid("API_AUDIENCE");
if (!Uri.TryCreate(issuer, UriKind.Absolute, out var authority) ||
    (authority.Scheme != Uri.UriSchemeHttps && !(authority.IsLoopback && authority.Scheme == Uri.UriSchemeHttp)))
{
    throw settings.Invalid("OIDC_AUTHORITY");
}

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.Authority = issuer;
    options.Audience = audience;
    options.RequireHttpsMetadata = authority.Scheme == Uri.UriSchemeHttps;
    options.MapInboundClaims = false;
    options.TokenValidationParameters.IgnoreTrailingSlashWhenValidatingAudience = false;
    options.TokenValidationParameters.RoleClaimType = "roles";
    options.TokenValidationParameters.ValidateIssuer = true;
    options.TokenValidationParameters.ValidateIssuerSigningKey = true;
    options.TokenValidationParameters.ValidateLifetime = true;
});
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Admin", policy => policy.RequireRole("admin"));

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/admin", () => Results.Ok(new { message = "Admin area" })).RequireAuthorization("Admin");
app.Run();

public partial class Program { }
