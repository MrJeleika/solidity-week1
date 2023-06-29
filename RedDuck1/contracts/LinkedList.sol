// SPDX-License-Identifier: MIT
pragma solidity ^ 0.8.9;

contract DoublyLinkedList {
    struct Data {
        uint256 price;
        uint256 amount;
    }

    struct Node {
        Data data;
        uint256 prev;
        uint256 next;
    }

    Node[] public nodes;
    uint256 public head;
    uint256 public tail;

    constructor() {
        nodes.push(Node(Data({
            price: 0,
            amount: 0
        }), type(uint256).max, type(uint256).max));
        head = 0;
        tail = 0;
    }

    function insertAfter(uint256 id, Data calldata data) public returns (uint256 newID) {
        require(id == 0 || isValidNode(id));

        Node storage node = nodes[id];

        nodes.push(Node({
            data: data,
            prev: id,
            next: node.next
        }));

        newID = nodes.length - 1;

        if (node.next != type(uint256).max) {
            nodes[node.next].prev = newID;
        } else {
            tail = newID;
        }
        
        node.next = newID;
    }



    function updateData(uint256 id, Data calldata data) public {
        require(id == 0 || isValidNode(id));
        nodes[id].data.amount += data.amount;
    }

    function insertBefore(uint256 id, Data calldata data) public returns(uint256 newID) {
        return insertAfter(nodes[id].prev, data);
    }

    function remove(uint256 id) public {
        require(isValidNode(id));

        Node storage node = nodes[id];

        nodes[node.next].prev = node.prev;
        nodes[node.prev].next = node.next;

        delete nodes[id];
    }

    function getNodes() public view returns(Node[] memory) {
        return nodes;
    }

    function isValidNode(uint256 id) internal pure returns(bool) {
        return id != type(uint).max;
    }
}