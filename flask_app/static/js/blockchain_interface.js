const Web3 = require("web3");
const ABI = require("./abi");

// getting supply chain adresses
const sc_abi = ABI.sc_abi;
const sc_address = ABI.sc_address;





// dom element initialisations
let getHistoryButton = document.getElementById("getHistoryButton");
let historyOutputSpan = document.getElementById("historyOutput");
let initiatePO = document.getElementById("initiatePO");
let purchaseOrderOutputSpan = document.getElementById("purchaseOrderOutput");

// initiating metamask environment
if (window.ethereum) {
    console.log("Connecting to Metamask");
    window.web3 = new Web3(ethereum);
    
    // Request account access if needed
    ethereum.enable().then((res) => {
        console.log("User granted access");
        console.log(res);
    }).catch((err) => {
        console.log("User denied access to account");
        console.log(err);
    });
    
    // creating a smart contract
    let sc_contract = new web3.eth.Contract(sc_abi, sc_address);
    
    // get history of the blockchain transactions
    getHistoryButton.addEventListener('click', () => {
        sc_contract
            .methods
            .getOrderSucessHistory(consumerAddress)
            .call({from: consumerAddress},
                  function (err, res) {
                      console.log("Called the SC fucntion");
                      if (err) {
                          console.log("Error Occured in calling SC method");
                          console.log(err);
                      } else {
                          console.log(res);
                          historyOutputSpan.innerText = res[0];
                      }
                  });
        
    });
    
    // initiate a purchase order on the blockchain
    initiatePO.addEventListener('click', () => {
        sc_contract
            .methods
            .initiatePurchaseOrder("mahmud", "raleigh", 1, 2)
            .send({from: consumerAddress})
            .on("receipt", function (receipt) {
                console.log(receipt);
                let po = receipt.events.CreateQuoteForCustomer.returnValues[0];
                purchaseOrderOutputSpan.innerText = po;
            });
    });
    
} else {
    // set the provider you want from Web3.providers
    console.log("Metamask not present. Aborting");
}


