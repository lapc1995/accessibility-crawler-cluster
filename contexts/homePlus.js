import * as fs from 'fs';
import { saveHtmlToFile, saveReportToJSONFile, removeDuplicateLinks, fixLink, generateFilename, forbiddenFilenameCharacters, hasInvalidExtension, removeHashFromUrl, delay, removeNonHTTPSLinks, shuffleArray, cleanLinkList, isSameDomain, saveMhtmlToFile, withTimeout } from '../utils.js';
import jsonfile from 'jsonfile';
// import { analysePrimarySite, analyseSecondarySite, getReportForURLParallel } from '../analyser.js';
// import { waitForBrowser, browser } from '../browserHandler.js';
// import * as db from '../lowdbDatabase.js'//'../localDatabase.js';
// import * as largeWebsitesDB from '../largeWebsitesDatabase.js';

// import * as vm from 'vm';

// import * as websitesCache from '../websitesCache.js';



import { isMalicious } from '../maliciousDomainDetector.js';

import * as analyser from '../analyser.js'
import { browserCluster } from '../clusterHandler.js';

import * as pageTracker from '../pageTracker.js';

import * as robotsTxtHandler from '../robotsTxtHandler.js';

async function getPageLinks({ page, data: url }) {
    console.log("Getting links for", url);

    let result = {
        'originalUrl': url,
        'url': null,
        'status': null,
        'error': null,
        'links': null,
    }

    let pageResult;
    try {
        pageResult = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.log("Error", e);
        result.error = e;
        return result;
    }
    if (pageResult == null) {
        console.log("Got null, trying wait.");
        pageResult = await pageResult.waitForResponse(() => true);
    }

    result.status = `${pageResult.status()}`;

    if (result.status != null && (result.status.charAt(0) == "4" || result.status.charAt(0) == "5")) {
        result.error = "Page status error";
        return result;
    };

    let currentUrl = await pageResult.url();
    currentUrl = new URL(currentUrl);
    result.url = currentUrl.href;

    if (isMalicious(currentUrl.host)) {
        console.log("Malicious domain");
        result.error = "Malicious domain";
        return result;
    }

    result.links = await analyser.getALinks(page);

    return result;
}

function removeMaliciousLinks(links) {
    let allowedLinks = [];
    links.forEach((link) => {
        let tempUrl = new URL(link.href);
        if (!isMalicious(tempUrl.host)) {
            allowedLinks.push(link);
        }
    });
    return allowedLinks;
}

function removeLinksFromOtherDomains(url, links) {  
    let allowedLinks = [];
    links.forEach((link) => {
        let tempUrl = new URL(link.href, url.href);
        if (isSameDomain(tempUrl.href, url)) {
            allowedLinks.push(link);
        }
    });
    return allowedLinks;
}

function createDomainFolder(url) {
    let dirname = url.replaceAll('https://', '');
    dirname = dirname.replaceAll('http://', '');
    if (dirname.slice(-1) == '/') {
        dirname = dirname.slice(0, -1);
    }

    forbiddenFilenameCharacters.forEach((character) => {
        dirname = dirname.replaceAll(character, "{");
    });

    dirname = `./data/${dirname}`;

    if (!fs.existsSync("./data")) {
        fs.mkdirSync("./data");
    }

    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname);
    }

    const dataFolder = `${dirname}/data`;
    const errorFolder = `${dirname}/error`;

    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder);
    }

    if (!fs.existsSync(errorFolder)) {
        fs.mkdirSync(errorFolder);
    }

    return {dataFolder, errorFolder, dirname};
}

function summaryFileExists(dirname) {
    return fs.existsSync(`${dirname}/summary.jsonld`);
}

export async function analyseDomain(url) {

    if (!url.includes('http')) {
        url = `https://${url}`;
    }

    let {dataFolder, errorFolder, dirname} = createDomainFolder(url);

    if (summaryFileExists(dirname)) {
        console.log("Domain already analysed", url);
        return;
    }

    let robotsTxt = await robotsTxtHandler.setRobotsTxt(url);
    if (robotsTxt != null) {
        let homepageAllowed = robotsTxt.isAllowed(url);
        if (!robotsTxtHandler.isURLAllowed(homepageAllowed)) {
            console.log("Home page is disallowed");
            return;
        }
    }

    let result = await browserCluster.execute(url, getPageLinks);
    let parsedUrl = new URL(result.url);

    let filtredLinks = cleanLinkList(result.url, result.links);
    filtredLinks = robotsTxtHandler.removeDisallowedLinks(robotsTxt, filtredLinks, url);
    filtredLinks = removeMaliciousLinks(filtredLinks);
    filtredLinks = removeLinksFromOtherDomains(parsedUrl, filtredLinks);

    console.log(filtredLinks.length + " links found");

    //analyse 20% of links
    let requiredNumberOfLinks = Math.round(filtredLinks.length * 0.20);
    let consecutiveRetryLimit = 5;

    console.log("Required number of links", requiredNumberOfLinks);


    let shuffledLinks = shuffleArray(filtredLinks);

    shuffledLinks = [{href: url}].concat(shuffledLinks);
    requiredNumberOfLinks += 1;

    await pageTracker.resetCounters();
    let index = 0;

    for (index = 0; index < requiredNumberOfLinks; index++) {
        let isHomePage = index == 0;
        let link = shuffledLinks[index].href;
        console.log("Queueing link", link);
        await browserCluster.queue({ url: link, options: {isHomePage, robotsTxt, homepageLink: parsedUrl}, dataFolder, errorFolder}, analyser.createReportAndSave);
    }

    let lastFailedCount = 0;    
    let lastSuccessCount = 0;
    let consecutiveRetry = 0;
    while (pageTracker.successCount != requiredNumberOfLinks) {
        //console.log(shuffledLinks.length, pageTracker.doneCount, pageTracker.successCount, pageTracker.failedCount, index, consecutiveRetry);
        if (lastFailedCount != pageTracker.failedCount) {
            lastFailedCount = pageTracker.failedCount;
            index += 1;

            if (index >= shuffledLinks.length || consecutiveRetry >= consecutiveRetryLimit) {
                break;
            }

            if(lastSuccessCount == pageTracker.successCount) {
                consecutiveRetry += 1;
            } else {
                consecutiveRetry = 0;
                lastSuccessCount = pageTracker.successCount;
            }

            let link = shuffledLinks[index].href;
            console.log("Queueing link", link);
            await browserCluster.queue({ url: link, options:{isHomePage: false, robotsTxt}, dataFolder, errorFolder }, analyser.createReportAndSave);
        }
        await delay(1000);
    }

    let summary = {
        'url': url,
        'redirectedUrl': result.url,
        'requiredNumberOfLinks': requiredNumberOfLinks,
        'totalLinks': shuffledLinks.length,
        'successCount': pageTracker.successCount,
        'failedCount': pageTracker.failedCount,
        'doneCount': pageTracker.doneCount,
        'links': shuffledLinks,
    }

    jsonfile.writeFileSync(`${dirname}/summary.jsonld`, summary);
}