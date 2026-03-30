pragma solidity ^0.4.13;

contract SmartSwitch {

    struct Switch {
        address addr;       // the address of the user who uses the service
        uint endTime;       // service stop time (UnixTime)
        uint startTime;     // 이용 시작 시각
        bool status;        // if status is true, then service is available
    }

    address public owner;   // the service owner's address
    address public iot;     // the address of the IoT device
    mapping (uint => Switch) public switches; // mapping for storing variables of type Switch
    uint public numPaid;    // 결제 횟수

    modifier onlyOwner() {  // 서비스 소유자 권한 체크
        require(msg.sender == owner);
        _;
    }

    modifier onlyIoT() {   // IoT 장치 권한 체크
        require(msg.sender == iot);
        _;
    }

    function SmartSwitch(address _iot) { // 생성자, IoT 주소를 파라미터로 받음
        owner = msg.sender;
        iot = _iot;
        numPaid = 0;
    }

    function payToSwitch() public payable { // 이더를 지불할 때 호출되는 함수
        // 지불액이 1이더가 아니면 처리를 종료함
        require(msg.value == 1000000000000000000); // 1 ETH
        // Switch 생성
        switches[numPaid++] = Switch({
            addr: msg.sender,
            endTime: now + 300,
            startTime: now,     // 이용 시작 시각 저장
            status: true
        });
    }

    // 조기 반납(환불) 함수
    function refund(uint _index) public {
        // 호출자는 해당 대여 기록의 사용자 본인이어야 함
        require(switches[_index].addr == msg.sender);
        // 아직 이용 중(status가 true)이어야 함
        require(switches[_index].status == true);

        uint startTime = switches[_index].startTime;
        uint endTime = switches[_index].endTime;
        uint totalTime = endTime - startTime;
        uint elapsed = now - startTime;

        // 총 대여시간의 50% 이전에 반납 요청 시: 0.5 ETH 환불
        if (elapsed < totalTime / 2) {
            // 반납 처리 후 status를 false로 변경
            switches[_index].status = false;
            msg.sender.transfer(500000000000000000); // 0.5 ETH
        } else {
            // 그 외의 경우: 환불 없음, 반납만 처리
            switches[_index].status = false;
        }
    }

    // 상태를 변경하는 함수, 이용 종료 시각에 호출됨, 파라미터는 switches의 키 값
    function updateStatus(uint _index) public onlyIoT {
        // index 값에 해당하는 Switch 구조체가 없으면 종료
        require(switches[_index].addr != 0);
        // 이용 종료 시각이 되지 않았으면 종료
        require(now > switches[_index].endTime);
        // 상태 변경
        switches[_index].status = false;
    }

    function withdrawFunds() public onlyOwner { // 지불된 이더를 인출하는 함수
        if(!owner.send(this.balance)) {
            revert();
        }
    }

    function kill() public onlyOwner { // 계약을 소멸시키는 함수
        selfdestruct(owner);
    }
}
