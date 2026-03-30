// ============================================
// SmartSwitch DApp - Web3.js 기반 앱 로직
// Ganache 로컬 블록체인과 연동
// ============================================

// ============================================
// (1) Ganache 연결
// JavaScript에서 Web3를 사용하여 Ganache에 직접 연결
// ============================================
var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));

// ============================================
// (2) ABI와 CA 주소를 이용한 계약 객체 생성
// Remix에서 복사한 ABI 코드와, 배포 후 발급된 CA 주소를 이용하여 계약 객체를 생성
// ============================================
var ABI = [
    {"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"type":"function"},
    {"constant":false,"inputs":[],"name":"payToSwitch","outputs":[],"payable":true,"type":"function"},
    {"constant":false,"inputs":[{"name":"_index","type":"uint256"}],"name":"refund","outputs":[],"payable":false,"type":"function"},
    {"constant":false,"inputs":[{"name":"_index","type":"uint256"}],"name":"updateStatus","outputs":[],"payable":false,"type":"function"},
    {"constant":false,"inputs":[],"name":"withdrawFunds","outputs":[],"payable":false,"type":"function"},
    {"constant":true,"inputs":[],"name":"iot","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},
    {"constant":true,"inputs":[],"name":"numPaid","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},
    {"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},
    {"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"switches","outputs":[{"name":"addr","type":"address"},{"name":"endTime","type":"uint256"},{"name":"startTime","type":"uint256"},{"name":"status","type":"bool"}],"payable":false,"type":"function"},
    {"inputs":[{"name":"_iot","type":"address"}],"payable":false,"type":"constructor"}
];

// ※ 배포 후 발급된 Contract Address(CA)를 여기에 붙여넣으세요
var CONTRACT_ADDRESS = "여기에_CA_주소를_붙여넣으세요";

// const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);  // Web3 1.x 방식
var contract = web3.eth.contract(ABI).at(CONTRACT_ADDRESS);        // Web3 0.20.x 방식

// 전역 변수
var accounts = [];
var selectedAccount = "";

// ============================================
// (3) 계정 선택 기능
// 웹 화면에서 Ganache 계정 중 하나를 선택하여 사용할 수 있도록 한다.
// 계정 목록 조회, 드롭다운 메뉴로 계정 선택, 현재 선택된 계정 표시
// ============================================
function loadAccounts() {
    web3.eth.getAccounts(function(err, accs) {
        if (err) {
            showResult("rentResult", "Ganache 계정을 불러올 수 없습니다. Ganache가 실행 중인지 확인하세요: " + err.message, true);
            updateConnectionStatus(false);
            return;
        }
        accounts = accs;
        var select = document.getElementById("accountSelect");
        select.innerHTML = "";

        for (var i = 0; i < accs.length; i++) {
            var option = document.createElement("option");
            option.value = accs[i];
            option.text = "accounts[" + i + "] : " + accs[i];
            select.appendChild(option);
        }

        selectedAccount = accs[0];
        document.getElementById("currentAccount").innerText = selectedAccount;
        updateConnectionStatus(true);
        updateBalance();
    });
}

// 계정 드롭다운 변경 이벤트
document.getElementById("accountSelect").addEventListener("change", function() {
    selectedAccount = this.value;
    document.getElementById("currentAccount").innerText = selectedAccount;
    updateBalance();
});

// 계정 잔액 업데이트
function updateBalance() {
    web3.eth.getBalance(selectedAccount, function(err, balance) {
        if (!err) {
            document.getElementById("accountBalance").innerText =
                web3.fromWei(balance, "ether").toString();
        }
    });
}

// Ganache 연결 상태 표시
function updateConnectionStatus(connected) {
    var el = document.getElementById("connectionStatus");
    if (connected) {
        el.className = "status connected";
        el.innerText = "Ganache 연결됨 (http://127.0.0.1:7545)";
    } else {
        el.className = "status disconnected";
        el.innerText = "Ganache 연결 실패 - Ganache를 실행하세요!";
    }
}

// ============================================
// (4) 킥보드 대여 기능
// 웹 화면에 "킥보드 대여하기" 버튼을 만들고, 클릭 시 다음 기능이 수행되도록 한다.
// 선택된 계정으로 payToSwitch() 호출, 1 ETH 전송, 대여가 성공하면 결과 메시지 출력
// ============================================
document.getElementById("btnRent").addEventListener("click", function() {
    var btn = document.getElementById("btnRent");
    btn.disabled = true;
    btn.innerText = "처리 중...";

    contract.payToSwitch({
        from: selectedAccount,
        value: web3.toWei(1, "ether"),
        gas: 300000
    }, function(err, txHash) {
        btn.disabled = false;
        btn.innerText = "킥보드 대여하기";

        if (err) {
            showResult("rentResult", "대여 실패: " + err.message, true);
        } else {
            // numPaid 조회하여 대여 번호 표시
            contract.numPaid(function(e, numPaid) {
                var rentalIndex = numPaid ? (numPaid.toNumber() - 1) : "?";
                showResult("rentResult",
                    "대여 성공!<br>" +
                    "대여 번호: <strong>" + rentalIndex + "</strong><br>" +
                    "TX Hash: " + txHash
                );
            });
            updateBalance();
        }
    });
});

// ============================================
// (5) 조기 반납(환불 요청) 기능
// 웹 화면에 "조기 반납(환불 요청)" 버튼을 만들고, 클릭 시 다음 기능이 수행되도록 한다.
// 사용자가 입력한 대여 번호(index)에 대해 refund(_index) 호출
// 환불 처리 결과를 화면에 출력
// ============================================
document.getElementById("btnRefund").addEventListener("click", function() {
    var index = parseInt(document.getElementById("refundIndex").value);
    if (isNaN(index) || index < 0) {
        showResult("refundResult", "올바른 대여 번호를 입력하세요.", true);
        return;
    }

    contract.refund(index, {
        from: selectedAccount,
        gas: 300000
    }, function(err, txHash) {
        if (err) {
            showResult("refundResult", "환불 요청 실패: " + err.message, true);
        } else {
            showResult("refundResult",
                "환불 처리 완료!<br>" +
                "대여 번호: " + index + "<br>" +
                "TX Hash: " + txHash
            );
            updateBalance();
        }
    });
});

// ============================================
// (6) IoT 반납 처리 기능
// 웹 화면에 "IoT 반납 처리" 버튼을 만들고, 클릭 시 다음 기능이 수행되도록 한다.
// IoT 장치 계정(accounts[3])을 사용하여 updateStatus(_index) 호출
// 상태 변경 결과를 화면에 출력
// ============================================
document.getElementById("btnIoT").addEventListener("click", function() {
    var index = parseInt(document.getElementById("iotIndex").value);
    if (isNaN(index) || index < 0) {
        showResult("iotResult", "올바른 대여 번호를 입력하세요.", true);
        return;
    }

    // IoT 장치 계정은 accounts[3]
    var iotAccount = accounts[3];
    if (!iotAccount) {
        showResult("iotResult", "IoT 계정(accounts[3])을 찾을 수 없습니다.", true);
        return;
    }

    contract.updateStatus(index, {
        from: iotAccount,
        gas: 300000
    }, function(err, txHash) {
        if (err) {
            showResult("iotResult", "IoT 반납 처리 실패: " + err.message, true);
        } else {
            showResult("iotResult",
                "상태 변경 완료!<br>" +
                "대여 번호: " + index + "<br>" +
                "IoT 계정: " + iotAccount + "<br>" +
                "TX Hash: " + txHash
            );
        }
    });
});

// ============================================
// (7) 상태 조회 기능
// 웹 화면에서 다음 정보를 조회할 수 있도록 한다.
// 특정 대여 번호의 사용자 주소, 종료 시각(endTime), 시작 시각(startTime),
// 이용 상태(status), 계약 잔액, 선택된 사용자 계정 잔액
// 조회 결과는 HTML 화면에 표시되어야 한다.
// ============================================
document.getElementById("btnQuery").addEventListener("click", function() {
    var index = parseInt(document.getElementById("queryIndex").value);
    if (isNaN(index) || index < 0) {
        showResult("statusResult", "올바른 대여 번호를 입력하세요.", true);
        return;
    }

    // switches 매핑에서 대여 정보 조회
    contract.switches(index, function(err, result) {
        if (err) {
            showResult("statusResult", "조회 실패: " + err.message, true);
            return;
        }

        var addr      = result[0];
        var endTime   = result[1].toNumber();
        var startTime = result[2].toNumber();
        var status    = result[3];

        if (addr === "0x0000000000000000000000000000000000000000") {
            showResult("statusResult", "해당 번호의 대여 기록이 없습니다.", true);
            return;
        }

        var endDate   = new Date(endTime * 1000).toLocaleString("ko-KR");
        var startDate = new Date(startTime * 1000).toLocaleString("ko-KR");

        var html = "<table>";
        html += "<tr><th>항목</th><th>값</th></tr>";
        html += "<tr><td>대여 번호</td><td>" + index + "</td></tr>";
        html += "<tr><td>사용자 주소</td><td>" + addr + "</td></tr>";
        html += "<tr><td>시작 시각 (startTime)</td><td>" + startDate + "</td></tr>";
        html += "<tr><td>종료 시각 (endTime)</td><td>" + endDate + "</td></tr>";
        html += "<tr><td>이용 상태 (status)</td><td>" + (status ? "이용 중" : "종료") + "</td></tr>";
        html += "</table>";

        document.getElementById("statusResult").innerHTML = html;
    });

    // 계약 잔액 조회
    web3.eth.getBalance(CONTRACT_ADDRESS, function(err, balance) {
        if (!err) {
            document.getElementById("contractBalance").innerText =
                web3.fromWei(balance, "ether").toString() + " ETH";
        }
    });

    // 선택된 사용자 계정 잔액 조회
    web3.eth.getBalance(selectedAccount, function(err, balance) {
        if (!err) {
            document.getElementById("selectedAccountBalance").innerText =
                web3.fromWei(balance, "ether").toString() + " ETH";
        }
    });

    updateBalance();
});

// ============================================
// 유틸리티 함수
// ============================================
function showResult(elementId, message, isError) {
    var el = document.getElementById(elementId);
    el.innerHTML = '<div class="' + (isError ? 'error' : 'result') + '">' + message + '</div>';
}

// ============================================
// 초기화: 페이지 로드 시 Ganache 계정 불러오기
// ============================================
loadAccounts();
