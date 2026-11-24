using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed class AdminTests(SignInFixture tokens, WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Theory]
    [InlineData("admin", HttpStatusCode.OK)]
    [InlineData("reader", HttpStatusCode.Forbidden)]
    [InlineData("id-token", HttpStatusCode.Unauthorized)]
    [InlineData("anonymous", HttpStatusCode.Unauthorized)]
    public async Task Checks_real_bearer_tokens(string caller, HttpStatusCode expected)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/admin");
        var token = caller switch
        {
            "admin" => tokens.AdminAccessToken,
            "reader" => tokens.ReaderAccessToken,
            "id-token" => tokens.AdminIdToken,
            _ => null,
        };
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Rejects_an_audience_that_differs_by_a_trailing_slash()
    {
        await using var host = factory.WithWebHostBuilder(web => web.ConfigureTestServices(services =>
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
                options.TokenValidationParameters.ValidAudience = options.Audience + "/")));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AdminAccessToken);
        using var response = await client.GetAsync("/admin", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
