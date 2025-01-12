import * as robotsParser from 'robots-parser';
import { browserCluster } from './clusterHandler.js';

export async function getRobotsTxtTask({ page, data: url }) {

    const robotsUrl = new URL('/robots.txt', url);

    let pageResult;
    try {
        pageResult = await page.goto(robotsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        return {url: robotsUrl.href, status: null, content: null, error: e};
    }

    if (pageResult == null) {
        console.log("Got null, trying wait.");
        pageResult = await pageResult.waitForResponse(() => true);
    }

    let status = `${pageResult.status()}`;
    if (status != null && (status.charAt(0) == "4" || status.charAt(0) == "5")) {
        return {url: robotsUrl.href, status, content: null, error: null};
    };

    // get page content
    let content = await pageResult.text();
    return {url: robotsUrl.href, status, content, error: null};
}


export async function setRobotsTxt(url) {
    if (!url.includes('http')) {
        url = `https://${url}`;
    } else {
        url = url.replace('http://', 'https://');
    }

    let result = await browserCluster.execute(url, getRobotsTxtTask);
    if (result.content == null) {
        return null;
    }
    return robotsParser.default(result.url, result.content);
}

export function isURLAllowed(allowResult) {
    return allowResult == undefined || (typeof allowResult === 'boolean' && allowResult)
}

export function removeDisallowedLinks(robotsTxt, links, url) {
    let allowedLinks = [];
    links.forEach((link) => {
        let tempUrl = new URL(link.href, url);
        const allowResult = robotsTxt.isAllowed(tempUrl.href);
        if (isURLAllowed(allowResult)) {
            allowedLinks.push(link);
        }
    });
    return allowedLinks;
}