const { Cookie } = require('tough-cookie');
const { utils } = require('../dist/index.cjs.js');
const { serializeForTough, serializeForPuppeteer } = utils;

describe('Cookie serialization', () => {
    
    describe('serializeForTough', () => {
        test('should convert puppeteer cookie to tough-cookie format correctly', () => {
            const puppeteerCookie = {
                "name": "session_id",
                "value": "abc123def456ghi789jkl",
                "domain": "example.com",
                "path": "/",
                "expires": 1758122904.332952,
                "size": 128,
                "httpOnly": false,
                "secure": true,
                "session": false,
                "priority": "Medium",
                "sameParty": false,
                "sourceScheme": "Secure",
                "sourcePort": 443
            };

            const toughCookie = serializeForTough(puppeteerCookie);

            expect(toughCookie.key).toBe("session_id");
            expect(toughCookie.value).toBe("abc123def456ghi789jkl");
            expect(toughCookie.domain).toBe("example.com");
            expect(toughCookie.path).toBe("/");
            expect(toughCookie.secure).toBe(true);
            expect(toughCookie.httpOnly).toBe(false);
            expect(toughCookie.hostOnly).toBe(true); // domain doesn't start with '.'
            expect(toughCookie.sameSite).toBe("none"); // default value
            
            // Check expires conversion (should preserve milliseconds)
            const expectedDate = new Date(1758122904.332952 * 1000);
            expect(toughCookie.expires).toEqual(expectedDate);
        });

        test('should handle cookies with dot-prefixed domain', () => {
            const puppeteerCookie = {
                "name": "test",
                "value": "value",
                "domain": ".example.com",
                "path": "/",
                "expires": 1758122904.332952,
                "httpOnly": true,
                "secure": false,
                "sameSite": "Lax"
            };

            const toughCookie = serializeForTough(puppeteerCookie);

            expect(toughCookie.hostOnly).toBe(false); // domain starts with '.'
            expect(toughCookie.sameSite).toBe("lax");
        });

        test('should handle infinity expires', () => {
            const puppeteerCookie = {
                "name": "test",
                "value": "value",
                "domain": "example.com",
                "path": "/",
                "expires": -1, // PuppeteerInfinityExpires
                "httpOnly": false,
                "secure": false
            };

            const toughCookie = serializeForTough(puppeteerCookie);

            expect(toughCookie.expires).toBe("Infinity");
        });
    });

    describe('serializeForPuppeteer', () => {
        test('should convert tough-cookie to puppeteer format correctly', () => {
            const toughCookie = new Cookie({
                key: "user_token",
                value: "xyz789uvw456rst123mno",
                domain: "example.com",
                path: "/",
                expires: new Date(1758122904.332952 * 1000),
                secure: true,
                httpOnly: false,
                hostOnly: true,
                sameSite: "none"
            });

            const puppeteerCookie = serializeForPuppeteer(toughCookie);

            expect(puppeteerCookie.name).toBe("user_token");
            expect(puppeteerCookie.value).toBe("xyz789uvw456rst123mno");
            expect(puppeteerCookie.domain).toBe("example.com");
            expect(puppeteerCookie.path).toBe("/");
            expect(puppeteerCookie.secure).toBe(true);
            expect(puppeteerCookie.httpOnly).toBe(false);
            expect(puppeteerCookie.sameSite).toBe("None"); // explicitly set to 'none'
            
            // Check expires conversion (should preserve milliseconds)
            // Note: precision is limited to milliseconds, so fractional milliseconds are lost
            expect(puppeteerCookie.expires).toBe(1758122904332);
        });

        test('should handle infinity expires', () => {
            const toughCookie = new Cookie({
                key: "test",
                value: "value",
                domain: "example.com",
                path: "/",
                expires: "Infinity",
                secure: false,
                httpOnly: true
            });

            const puppeteerCookie = serializeForPuppeteer(toughCookie);

            expect(puppeteerCookie.expires).toBe(-1); // PuppeteerInfinityExpires
        });

        test('should handle missing domain', () => {
            const toughCookie = new Cookie({
                key: "test",
                value: "value",
                path: "/",
                secure: false,
                httpOnly: true
            });

            expect(() => serializeForPuppeteer(toughCookie)).toThrow("Unknown domain");
        });

        test('should handle default sameSite behavior', () => {
            const toughCookie = new Cookie({
                key: "test",
                value: "value",
                domain: "example.com",
                path: "/",
                secure: false,
                httpOnly: false
                // sameSite not specified, should default to 'Lax'
            });

            const puppeteerCookie = serializeForPuppeteer(toughCookie);

            expect(puppeteerCookie.sameSite).toBe("Lax"); // default behavior
        });
    });

    describe('round-trip conversion', () => {
        test('should preserve cookie data through puppeteer -> tough -> puppeteer conversion', () => {
            const originalPuppeteerCookie = {
                "name": "test_cookie",
                "value": "test_value",
                "domain": "example.com",
                "path": "/test",
                "expires": 1758122904.332952,
                "httpOnly": false,
                "secure": true,
                "sameSite": "Strict"
            };

            // Convert to tough-cookie format
            const toughCookie = serializeForTough(originalPuppeteerCookie);
            
            // Convert back to puppeteer format
            const convertedPuppeteerCookie = serializeForPuppeteer(toughCookie);

            // Verify key properties are preserved
            expect(convertedPuppeteerCookie.name).toBe(originalPuppeteerCookie.name);
            expect(convertedPuppeteerCookie.value).toBe(originalPuppeteerCookie.value);
            expect(convertedPuppeteerCookie.domain).toBe(originalPuppeteerCookie.domain);
            expect(convertedPuppeteerCookie.path).toBe(originalPuppeteerCookie.path);
            expect(convertedPuppeteerCookie.secure).toBe(originalPuppeteerCookie.secure);
            expect(convertedPuppeteerCookie.httpOnly).toBe(originalPuppeteerCookie.httpOnly);
            
            // Check that expires timestamp is preserved (within reasonable precision)
            const originalTimestamp = originalPuppeteerCookie.expires * 1000;
            expect(Math.abs(convertedPuppeteerCookie.expires - originalTimestamp)).toBeLessThan(1); // within 1ms
        });

        test('should document properties lost in round-trip conversion', () => {
            // Puppeteer cookies have additional properties that tough-cookie doesn't support
            const fullPuppeteerCookie = {
                "name": "test",
                "value": "value",
                "domain": "example.com",
                "path": "/",
                "expires": 1758122904.332952,
                "httpOnly": false,
                "secure": true,
                "sameSite": "Lax",
                // Puppeteer-specific properties that will be lost:
                "size": 25,
                "session": false,
                "priority": "Medium",
                "sameParty": false,
                "sourceScheme": "Secure", 
                "sourcePort": 443
            };

            // Convert through tough-cookie and back
            const toughCookie = serializeForTough(fullPuppeteerCookie);
            const convertedCookie = serializeForPuppeteer(toughCookie);

            // Standard cookie properties should be preserved
            expect(convertedCookie.name).toBe(fullPuppeteerCookie.name);
            expect(convertedCookie.value).toBe(fullPuppeteerCookie.value);
            expect(convertedCookie.domain).toBe(fullPuppeteerCookie.domain);
            expect(convertedCookie.path).toBe(fullPuppeteerCookie.path);
            expect(convertedCookie.httpOnly).toBe(fullPuppeteerCookie.httpOnly);
            expect(convertedCookie.secure).toBe(fullPuppeteerCookie.secure);
            expect(convertedCookie.sameSite).toBe(fullPuppeteerCookie.sameSite);

            // Puppeteer-specific properties are lost (this is expected behavior)
            // These are browser metadata auto-generated when reading cookies, not required for setting
            expect(convertedCookie.size).toBeUndefined();
            expect(convertedCookie.session).toBeUndefined();
            expect(convertedCookie.priority).toBeUndefined();
            expect(convertedCookie.sameParty).toBeUndefined();
            expect(convertedCookie.sourceScheme).toBeUndefined();
            expect(convertedCookie.sourcePort).toBeUndefined();
        });

        test('should handle the specific case from the problem description', () => {
            // This is the exact cookie format from the problem description
            const originalPuppeteerCookie = {
                "name": "auth_session",
                "value": "mno123pqr456stu789vwx",
                "domain": "example.com",
                "path": "/",
                "expires": 1758122904.332952,
                "size": 128,
                "httpOnly": false,
                "secure": true,
                "session": false,
                "priority": "Medium",
                "sameParty": false,
                "sourceScheme": "Secure",
                "sourcePort": 443
                // Note: sameSite is not specified in original, so it will default to 'none' in tough-cookie
            };

            // Convert to tough-cookie format
            const toughCookie = serializeForTough(originalPuppeteerCookie);
            
            // Convert back to puppeteer format
            const convertedPuppeteerCookie = serializeForPuppeteer(toughCookie);

            // Verify the problems mentioned in the description are fixed:
            
            // 1. httpOnly should be preserved (was incorrectly set to true)
            expect(convertedPuppeteerCookie.httpOnly).toBe(false);
            
            // 2. expires should preserve the millisecond precision as much as possible
            // Original: 1758122904.332952 * 1000 = 1758122904332.952
            // Expected: 1758122904332 (millisecond precision)
            expect(convertedPuppeteerCookie.expires).toBe(1758122904332);
            
            // 3. sameSite: since not specified in original, tough-cookie sets it to default 'none', 
            //    which should convert back to 'None' (not 'Lax' which would be wrong)
            expect(convertedPuppeteerCookie.sameSite).toBe('None');
            
            // 4. Basic properties should be preserved
            expect(convertedPuppeteerCookie.name).toBe('auth_session');
            expect(convertedPuppeteerCookie.value).toBe(originalPuppeteerCookie.value);
            expect(convertedPuppeteerCookie.domain).toBe('example.com');
            expect(convertedPuppeteerCookie.path).toBe('/');
            expect(convertedPuppeteerCookie.secure).toBe(true);

            // 5. Properties not supported by tough-cookie are expected to be lost:
            // These are browser metadata that get auto-generated by Puppeteer when reading cookies
            // but are NOT required when setting cookies (as verified by puppeteer-compatibility tests)
            // - size: auto-calculated by browser based on name+value length
            // - session: auto-determined by browser based on expires value
            // - priority: auto-set by browser (usually "Medium")
            // - sameParty: auto-set by browser (usually false)
            // - sourceScheme: auto-set by browser based on the page that set the cookie
            // - sourcePort: auto-set by browser based on the page that set the cookie
            expect(convertedPuppeteerCookie.size).toBeUndefined();
            expect(convertedPuppeteerCookie.session).toBeUndefined();
            expect(convertedPuppeteerCookie.priority).toBeUndefined();
            expect(convertedPuppeteerCookie.sameParty).toBeUndefined();
            expect(convertedPuppeteerCookie.sourceScheme).toBeUndefined();
            expect(convertedPuppeteerCookie.sourcePort).toBeUndefined();
        });
    });
});
