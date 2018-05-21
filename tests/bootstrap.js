const CurlRequest = require('curl-request'),
      knex = require('knex');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const WAIT_TIME = 5000;
const MAX_RETRIES = 10;

const PUBLIC_ANNOUNCEMENT =
'-------------------------------------------------------------------\n \
  * To test against your local databases (couch/postgres),\n\
   please define these env vars:\n\n \
    TEST_COUCH_URL (ie: http://admin:pass@localhost:5984) &\n \
    TEST_PG_URL    (ie: postgres://locahost:5432)\n\n\n\
  * Everything can also be tested with:\n\n\
    docker-compose run test grunt test\n\n\
-----------------------------------------------------------------';

const curl = new CurlRequest();

const waitForDb = async ({url, fn, retries=0}) => {
  if(retries ++ >= MAX_RETRIES) {
    console.log(`****** ERROR: Unable to connect: ${url}`);
    process.exit(1);
  }
  if(!await fn()) {
    if(!url) {
      console.log(PUBLIC_ANNOUNCEMENT);
      process.exit(1);
    }
    console.log(`====> Waiting on ${url} to appear.`);
    await wait(WAIT_TIME);
    await waitForDb({url: url, fn: fn, retries: retries});
  }
};

const waitForCouch = async (url) => {
  await waitForDb({url: url, fn: async () => {
    try {
      const {statusCode} = await curl.get(url);
      if(statusCode === 200) {
        console.log(`- Couch [${url}] is now avaliable.`);
        return true;
      }
    } catch(err) {
      //Ignore
      console.log(err);
    }
  }});
};

const waitForPg = async (url) => {
  const conn = knex({client: 'pg', connection: url});
  await waitForDb({url: url, fn: async () => {
    try {
      await conn.raw('SELECT * FROM pg_catalog.pg_tables');
      console.log(`- Postgres [${url}] is now avaliable.`);
      await conn.destroy();
      return true;
    } catch(err) {
      if(err.code !== 'ECONNREFUSED') {
        console.log(err);
        process.exit(1);
      }
    }
  }});
};

before(async () => {
  await waitForCouch(process.env.TEST_COUCH_URL);
  await waitForPg(process.env.TEST_PG_URL);
});
