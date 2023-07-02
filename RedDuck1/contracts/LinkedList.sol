// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

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

    Node[] private nodes;
    uint256 public head;
    uint256 public tail;

    constructor() {
        nodes.push(Node(Data(0, 0), type(uint256).max, type(uint256).max));
        head = 0;
        tail = 0;
    }

    function insertAfter(uint256 id, Data calldata data) internal isValidNode(id) returns (uint256 newID) {
        if (nodes[id].prev != type(uint256).max) {
            require(nodes[nodes[id].prev].data.amount <= data.amount, "invalid id");
        }

        if (nodes[id].next != type(uint256).max) {
            require(nodes[nodes[id].next].data.amount >= data.amount, "invalid id");
        }
        Node storage node = nodes[id];

        nodes.push(Node({data: data, prev: id, next: node.next}));

        newID = nodes.length - 1;

        if (node.next != type(uint256).max) {
            nodes[node.next].prev = newID;
        } else {
            tail = newID;
        }

        node.next = newID;

        return newID;
    }

    function increaseAmount(uint256 id, Data calldata data) internal isValidNode(id) {
        require(nodes[id].data.price == data.price && id != 0, "Invalid data");
        nodes[id].data.amount += data.amount;
    }

    function insertBefore(uint256 id, Data calldata data) internal isValidNode(id) returns (uint256 newID) {
        return insertAfter(nodes[id].prev, data);
    }

    function remove(uint256 id) internal isValidNode(id) {
        Node storage node = nodes[id];

        nodes[node.next].prev = node.prev;
        nodes[node.prev].next = node.next;

        delete nodes[id];
    }

    function getNodes() public view returns (Node[] memory) {
        return nodes;
    }

    modifier isValidNode(uint256 id) {
        require(id == 0 || (id != type(uint).max && id < nodes.length), "Invalid index");
        _;
    }

    // function checkNodePosition(uint256 id) internal{
    //     Node memory currNode = nodes[id];
    //     if(nodes[nodes[id].next].data.amount >= nodes[id].data.amount && nodes[nodes[id].prev].data.amount <= nodes[id].data.amount){
    //         return;
    //     }else if(nodes)
    // }

    function swapNodesData(uint256 node1, uint256 node2) public isValidNode(node1) isValidNode(node2) returns(uint256, uint256) {
        require(nodes[node1].data.amount > nodes[node2].data.amount, "Invalid data");
        Data memory temp = nodes[node1].data;
        nodes[node1].data = nodes[node2].data;
        nodes[node2].data = temp;
        
    }
}
