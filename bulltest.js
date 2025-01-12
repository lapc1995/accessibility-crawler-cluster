import Queue from 'bull';

const getReportQueue = new Queue('video transcoding');

import { browserCluster, initCluster } from './clusterHandler.js';
import { createReport } from './analyser.js'
import * as homePlus from './contexts/homePlus.js';


// videoQueue.process(function (job, done) {

//   // job.data contains the custom data passed when the job was created
//   // job.id contains id of this job.

//   // transcode video asynchronously and report progress
//   job.progress(42);

//   console.log(job.data);

//   // call done when finished
//   done();
// });

getReportQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
});

getReportQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error: ${err.message}`);
});

getReportQueue.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}%`);
});

getReportQueue.process(5, async (job, done) => {
    console.log(`Processing job ${job.id} with task number: ${job.data.taskNumber}`);
    await homePlus.analyseDomain(job.data.url);
});


(async () => {

    await initCluster();
    // const cluster = await Cluster.launch({
    //     concurrency: Cluster.CONCURRENCY_CONTEXT,
    //     maxConcurrency: 2,
    // });


    // browserCluster.queue('http://www.google.com/', task);
    // browserCluster.queue('http://www.wikipedia.org/', task);
    // // browserCluster more pages


    //let domains = ['http://www.google.com/', 'http://www.wikipedia.org/'];
    //let domains = ['https://www.northumbria.ac.uk/']
    let domains = ['http://www.google.com/'];
    for(let i = 0; i < domains.length; i++) {
        getReportQueue.add({ url: domains[i] });
    }

    await browserCluster.idle();
    await browserCluster.close();
})();



