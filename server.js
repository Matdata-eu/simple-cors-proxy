// keywords: express pass param to proxy createProxyMiddleware x-url-destination
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const morgan = require('morgan'); // Middleware for logging HTTP requests
const chalk = require('chalk'); // Module to add colors to console output

const app = express();

// Parse application/json content-type
app.use(bodyParser.json());

// Use morgan for logging incoming requests with added color for better readability
app.use(morgan(chalk.blue(':method') + ' ' + chalk.green(':url') + ' ' + chalk.yellow(':status') + ' ' + chalk.magenta(':response-time ms')));

// Middleware to delete headers from the request
const deleteHeadersMiddleware = (req, res, next) => {
    'use strict';

    const { headers } = req;
    const headersToDelete = new Set([
        ...(headers['x-headers-delete'] || '').split(',').map(header => header.trim()),
        ...(process.env.HEADERS_TO_DELETE || '').split(',').map(header => header.trim())
    ]);

    headersToDelete.forEach(header => {
        delete headers[header.toLowerCase()];
    });

    delete headers['x-headers-delete'];

    next();
};

// Middleware to check an optional API key
const checkApiKeyMiddleware = (req, res, next) => {
    'use strict';

    const { headers } = req;
    if (process.env.PROXY_TOKEN) {
        if (req.headers['x-proxy-token'] !== process.env.PROXY_TOKEN) {
            res.sendStatus(401);
            return;
        } else {
            delete headers['x-proxy-token'];
        }
    }

    next();
};

// Configuration for the proxy middleware
const corsProxyOptions = {
    target: 'http://host_to_be_superseeded_by_router', // The target host (replaced by the X-Url-Destination header in router)
    changeOrigin: true,
    logLevel: 'debug', // Enable verbose logging for the proxy
    router: (req) => {
        // Check if the request has a specific destination URL
        if (req.headers['x-url-destination']) {
            const url = new URL(req.headers['x-url-destination']);
            console.log(chalk.cyan('Proxying request to host :'), chalk.cyanBright(url.origin));
            return url.origin;
        } else {
            // Log and throw an error if the X-Url-Destination header is not found
            console.log(chalk.red('No X-Url-Destination header found'));
            throw new Error('You need to set the X-url-destination header');
        }
    },
    pathRewrite: function (path, req) {
        // Take the full URL in req['x-url-destination'], and return only the path part
        const url = new URL(req.headers['x-url-destination']);
        console.log(chalk.cyan('Proxying request to path :'), chalk.cyanBright(url.pathname + url.search));
        return url.pathname + url.search;
    },
    onProxyReq: (proxyReq, req, res) => {
        // Log the proxying of the request and the original request headers
        console.log(chalk.cyan('Proxying request to:'), chalk.cyanBright(req.url));
        console.log(chalk.cyan('Original request headers:'), req.headers);

        // Remove specific headers from the proxy request
        proxyReq.removeHeader('x-forwarded-host');
        proxyReq.removeHeader('x-forwarded-proto');
        proxyReq.removeHeader('x-forwarded-for');
        proxyReq.removeHeader('x-url-destination');

        // Log the modified request headers
        console.log(chalk.cyan('Modified request headers:'), proxyReq.getHeaders());
    },
    onProxyRes: (proxyRes, req, res) => {
        // Log the received response status and original response headers
        console.log(chalk.green('Received response with status:'), chalk.greenBright(proxyRes.statusCode));
        console.log(chalk.green('Original response headers:'), proxyRes.headers);

        // Adjust response headers based on the original request
        const origin = req.headers['origin'] || '*';
        const allowMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
        const allowHeaders = 'Accept, Authorization, Content-Length, Content-Type, Depth, DPoP, If-None-Match, Link, Location, On-Behalf-Of, Origin, Slug, WebID-TLS, X-Requested-With';
        const exposeHeaders = 'Content-disposition,Content-Type,Access-Control-Allow-Headers,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Allow,Accept-Patch,Accept-Post,Authorization,Content-Length,ETag,Last-Modified,Link,Location,Updates-Via,User,Vary,WAC-Allow,WWW-Authenticate';
        
        // Set headers in both uppercase and lowercase formats for maximum compatibility
        proxyRes.headers['Access-Control-Allow-Origin'] = origin;
        proxyRes.headers['access-control-allow-origin'] = origin;
        
        proxyRes.headers['Access-Control-Allow-Methods'] = allowMethods;
        proxyRes.headers['access-control-allow-methods'] = allowMethods;
        
        proxyRes.headers['Access-Control-Allow-Headers'] = allowHeaders;
        proxyRes.headers['access-control-allow-headers'] = allowHeaders;
        
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        
        proxyRes.headers['Access-Control-Max-Age'] = '86400';
        proxyRes.headers['access-control-max-age'] = '86400';
        
        proxyRes.headers['Access-Control-Expose-Headers'] = exposeHeaders;
        proxyRes.headers['access-control-expose-headers'] = exposeHeaders;

        // Log the modified response headers
        console.log(chalk.green('Modified response headers:'), proxyRes.headers);
    },
    onError: (err, req, res) => {
        // Log any errors encountered by the proxy
        console.error(chalk.red('Proxy encountered an error:'), err);
    },
};

// Handle OPTIONS requests (preflight) for all routes without proxying
app.options('*', (req, res) => {
    console.log(chalk.yellow('Received OPTIONS request (preflight) for:'), chalk.yellowBright(req.originalUrl));
    const origin = req.headers['origin'] || '*';
    const allowMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    const allowHeaders = 'Accept, Authorization, Content-Length, Content-Type, Depth, DPoP, If-None-Match, Link, Location, On-Behalf-Of, Origin, Slug, WebID-TLS, X-Requested-With';
    const exposeHeaders = 'Content-disposition,Content-Type,Access-Control-Allow-Headers,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Allow,Accept-Patch,Accept-Post,Authorization,Content-Length,ETag,Last-Modified,Link,Location,Updates-Via,User,Vary,WAC-Allow,WWW-Authenticate';
    
    // Set headers in both uppercase and lowercase formats for maximum compatibility
    res.header('Access-Control-Allow-Origin', origin);
    res.header('access-control-allow-origin', origin);
    
    res.header('Access-Control-Allow-Methods', allowMethods);
    res.header('access-control-allow-methods', allowMethods);
    
    res.header('Access-Control-Allow-Headers', allowHeaders);
    res.header('access-control-allow-headers', allowHeaders);
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('access-control-allow-credentials', 'true');
    
    res.header('Access-Control-Max-Age', '86400');
    res.header('access-control-max-age', '86400');
    
    res.header('Access-Control-Expose-Headers', exposeHeaders);
    res.header('access-control-expose-headers', exposeHeaders);
    
    res.sendStatus(200);
});

// Apply the middleware to delete headers
app.use(deleteHeadersMiddleware);
// Apply the middleware to check an optional API key
app.use(checkApiKeyMiddleware);

/**
 * Intercept the entire URL provided after "/proxy/".
 * Using `req.originalUrl` preserves query parameters if present.
 * Example: GET /proxy/https://example.com/some/path?foo=1 => everything after "/proxy/" is preserved.
 */
app.use('/proxy', (req, res, next) => {
    const prefix = '/proxy/';

    // If the originalUrl starts with /proxy/ and has more content
    if (req.originalUrl.startsWith(prefix) && req.originalUrl.length > prefix.length) {
        // Remove "/proxy/" from the beginning of the string
        const encodedUrl = req.originalUrl.substring(prefix.length);

        // Decode the entire string in case it was URL-encoded
        const decodedUrl = decodeURIComponent(encodedUrl);

        // Set the X-Url-Destination header to the full decoded URL (including any query params)
        req.headers['x-url-destination'] = decodedUrl;
    }
    next();
}, createProxyMiddleware(corsProxyOptions));

// Start the server with user-friendly logging
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(chalk.green(`Server is running on port ${PORT}`));
});
