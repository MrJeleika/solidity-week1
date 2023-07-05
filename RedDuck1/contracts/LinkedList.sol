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

    function insertAfter(uint256 id, Data memory data) internal isValidNode(id) returns (uint256 newID) {
        Node storage node = nodes[id];

        if (node.prev != type(uint256).max) {
            require(nodes[node.prev].data.amount <= data.amount, "Invalid id");
        }

        if (nodes[id].next != type(uint256).max) {
            require(nodes[node.next].data.amount >= data.amount, "Invalid id");
        }

        require(node.data.amount <= data.amount, "Invalid id");

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

    function increaseAmount(uint256 id, Data memory data) internal isValidNode(id) {
        require(nodes[id].data.price == data.price && id != 0, "Invalid data");
        nodes[id].data.amount += data.amount;
    }

    function decreaseAmount(uint256 id, Data memory data) internal isValidNode(id) {
        require(nodes[id].data.price == data.price && id != 0, "Invalid data");
        nodes[id].data.amount -= data.amount;
    }

    function remove(uint256 id) internal isValidNode(id) {
        Node storage node = nodes[id];

        if (node.next != type(uint256).max && node.prev != type(uint256).max) {
            nodes[node.next].prev = node.prev;
            nodes[node.prev].next = node.next;
        }

        if (node.prev == type(uint256).max) {
            nodes[node.next].prev = type(uint256).max;
        }
        if (node.next == type(uint256).max) {
            nodes[node.prev].next = type(uint256).max;
        }

        if (id == tail) {
            tail = node.prev;
        }

        delete nodes[id];
    }

    function getNodes() public view returns (Node[] memory) {
        return nodes;
    }

    modifier isValidNode(uint256 id) {
        require(id == 0 || (id != type(uint).max && id < nodes.length), "Invalid id");
        _;
    }
}
