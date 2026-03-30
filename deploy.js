// ============================================
// deploy.js - SmartSwitch 스마트계약 배포 스크립트
// Node.js + Web3.js 1.x를 사용하여 Ganache에 직접 배포
// ============================================
// 사용법: node deploy.js
// 전제조건: Ganache가 http://127.0.0.1:7545 에서 실행 중이어야 함

const Web3 = require("web3");
const fs = require("fs");
const path = require("path");
const solc = require("solc");

// (1) Ganache 연결
const web3 = new Web3("http://127.0.0.1:7545");

async function deploy() {
    console.log("============================================");
    console.log("SmartSwitch 스마트계약 배포 시작");
    console.log("============================================\n");

    // Ganache 계정 목록 조회
    const accounts = await web3.eth.getAccounts();
    console.log("Ganache 계정 목록:");
    accounts.forEach(function(acc, i) {
        console.log("  accounts[" + i + "]: " + acc);
    });
    console.log("");

    // 소유자(owner): accounts[0]
    // IoT 장치(iot):  accounts[3]
    const ownerAccount = accounts[0];
    const iotAccount   = accounts[3];

    console.log("계약 소유자 (owner): " + ownerAccount);
    console.log("IoT 장치 주소 (iot): " + iotAccount);
    console.log("");

    // (2) Solidity 소스 읽기 & 컴파일
    const sourceFile = path.join(__dirname, "SmartSwitch.sol");
    const source = fs.readFileSync(sourceFile, "utf8");
    console.log("Solidity 소스 파일 읽기 완료: SmartSwitch.sol");

    // solc 0.4.x 컴파일
    const compiled = solc.compile(source, 1);

    if (compiled.errors) {
        console.error("컴파일 에러:");
        compiled.errors.forEach(function(e) { console.error(e); });
        if (!compiled.contracts[":SmartSwitch"]) {
            process.exit(1);
        }
    }

    const contractData = compiled.contracts[":SmartSwitch"];
    const abi      = JSON.parse(contractData.interface);
    const bytecode = "0x" + contractData.bytecode;

    console.log("컴파일 완료!");
    console.log("");

    // (3) 배포
    console.log("Ganache에 스마트계약 배포 중...");
    const SmartSwitch = new web3.eth.Contract(abi);

    const deployTx = SmartSwitch.deploy({
        data: bytecode,
        arguments: [iotAccount]  // 생성자 파라미터: IoT 주소
    });

    const gasEstimate = await deployTx.estimateGas({ from: ownerAccount });

    const deployed = await deployTx.send({
        from: ownerAccount,
        gas: gasEstimate + 100000
    });

    const contractAddress = deployed.options.address;

    console.log("");
    console.log("============================================");
    console.log("배포 완료!");
    console.log("============================================");
    console.log("Contract Address (CA): " + contractAddress);
    console.log("Owner:                 " + ownerAccount);
    console.log("IoT:                   " + iotAccount);
    console.log("");

    // (4) ABI와 CA를 파일로 저장 (웹 프로그램에서 사용)
    const config = {
        contractAddress: contractAddress,
        abi: abi,
        owner: ownerAccount,
        iot: iotAccount,
        ganacheUrl: "http://127.0.0.1:7545"
    };

    const configPath = path.join(__dirname, "contract-config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("계약 설정 저장됨: contract-config.json");
    console.log("");
    console.log("다음 단계:");
    console.log("  1. app.js 파일에서 CONTRACT_ADDRESS 를 위 CA 주소로 변경");
    console.log("  2. node server.js 로 웹 서버 실행");
    console.log("  3. 브라우저에서 http://localhost:3000 접속");
}

deploy().catch(function(err) {
    console.error("배포 실패:", err.message);
    process.exit(1);
});
