
const fs = require("fs");
const util = require("util");
const exec = require('child_process').exec;
const {run} = require('./systemdef.js')
const {reset} = require('./dev.js')
const {loggerCreator} = require('./loggerConfig.js')

const exec_promise =  util.promisify(exec);
// var privateKey  = fs.readFileSync('certs/key.pem', 'utf8');
// var certificate = fs.readFileSync('certs/cert.pem', 'utf8');

// var credentials = {key: privateKey, cert: certificate};
const message_prefix = "server data exchange : " 
const logger = loggerCreator(message_prefix)


var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
    port: 8082
});

const run_simulation = async () => {
    let output = (await exec_promise(`node ${process.cwd()}/runSimulation.js`)).stdout;
    console.log(output)
}

const visualize = async (jsonobj, ws) => {
    const data_to_be_send = {"vis":jsonobj};
    const message = "Sending data to cleint : " + JSON.stringify(data_to_be_send);
    logger.info(message);
    ws.send(JSON.stringify(data_to_be_send));
};

const update_simulation  = async function (websocket) {
    logger.info("updated simulation");
    console.log("updating");

    reset();
    // await run_simulation();
    // let array_of_items;
    let array_of_items = await run
    console.log(array_of_items)
    await visualize (array_of_items, websocket)
}

const execute_data_cell_processing = async (websocket)=>{
    child = exec(`./cpp_bins/main`,
    function (error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ' + error);
        }
        console.log(stdout);
        try {
            const output_data = JSON.parse(fs.readFileSync('inputoutput/output_data.json', 'utf8'));
            websocket.send(output_data.data);
            } catch (err) {
            console.error(err)
        };
    });
}

const initiate_simulation = async (websocket) => {
    await update_simulation(websocket);
    console.log("New client connected");
    websocket.on("close", () => {
        console.log("Client has disconnected");
    });
}

const register_data = data => {
    var msg = data.vis;    
    fs.writeFileSync('inputoutput/input_data.json', msg, (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

const accept_simulation_from_client = data => {
    var msg = data.simulation_data;    
    fs.writeFileSync('simulations/livebeehive.js', msg, (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

wss.on("connection" , async ws => {
    initiate_simulation(ws);
    ws.onmessage =(async blobdata => {
        const data = JSON.parse(blobdata.data);
        console.log(data)
        const message = "recived data from client as " + JSON.stringify(data)
        logger.info(message);
        if ("simulation_data" in data){
            console.log("received simulation data from cleint");
            const message = "received simulation data from cleint ";
            logger.info(message);

            accept_simulation_from_client(data);
            await update_simulation(ws);
        }
        if ("cellmech_data" in data){
            console.log("received cell data from cleint");
            const message = "received cell data from cleint ";
            logger.info(message);

            register_data(data);
            await execute_data_cell_processing(ws);
        }
    });
});
