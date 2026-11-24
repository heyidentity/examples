# Spring Boot OAuth2 login

Use JDK 21, Node.js 22.12 or later, and Git. Replace `{EXAMPLE_REVISION}` with the commit you want to run. From the directory that will hold the checkout:

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples
git checkout --detach {EXAMPLE_REVISION}
```

Reuse an active Generic configuration with a matching public client and registered URLs. If your current settings belong to a different profile or an expired temporary tenant, use a separate checkout. Temporary setup asks you to accept the Terms of Use, and the tenant expires after seven days unless you claim it. [Claim or recover a setup](../../setup/README.md).

From the checkout root:

```sh
node setup/provision.mjs --temporary
```

For your own Generic configuration, fill the root `.env` with the issuer and client ID and register `http://localhost:5173/login/oauth2/code/heyidentity` and `http://localhost:5173/` on the public client. See the [test user and role settings](../../CONTRACT.md#configuration).

## Run and verify

From the checkout root:

```sh
apps/spring-boot/gradlew -p apps/spring-boot bootJar
java -jar apps/spring-boot/build/libs/spring-boot-example.jar
```

On Windows, use `apps\spring-boot\gradlew.bat` as the wrapper command. At `http://localhost:5173/`, sign in as the admin and open **Admin**. Sign out and repeat with the reader. The app shows the reader's identity and **Access denied**.

For Playwright, build the JAR, stop any previous app on the configured port and set `EXAMPLE_APP_COMMAND="java -jar apps/spring-boot/build/libs/spring-boot-example.jar"` in the root `.env`. Then run:

```sh
cd playwright/typescript
npm ci
npx playwright install chromium
npx playwright test
npx playwright test --config missing-settings.config.ts
```
