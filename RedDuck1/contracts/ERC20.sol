// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IERC20.sol";

contract ERC20 is IERC20 {

  uint256 public _totalSupply;
  
  mapping (address => uint) public balances;
  mapping(address => mapping(address => uint256)) public allowances;

  string private _name;
  string private _symbol;

  constructor(string memory name_, string memory symbol_, uint256 _initialSupply){
    _totalSupply = _initialSupply;
    _name = name_;
    _symbol = symbol_;
  }

  function name() external view virtual returns (string memory) {
    return _name;
  }

  function symbol() external view virtual returns (string memory) {
    return _symbol;
  }

  function decimals() external pure returns(uint256){
    return 18;
  }

  function totalSupply() external view override returns(uint256){
    return _totalSupply;
  }

  function balanceOf(address account) public view returns(uint256){
    return balances[account];
  }

  modifier enoughTokens(address from, uint256 amount){
    require(balances[from] >= amount, "Not enough tokens");
    _;
  }

  function transfer(address recipient, uint256 amount) external virtual returns (bool){
    balances[msg.sender] -= amount;
    balances[recipient] += amount;
    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function approve(address spender, uint256 amount) external returns(bool){
    allowances[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint amount
  ) external returns (bool) {
    allowances[sender][msg.sender] -= amount;
    balances[sender] -= amount;
    balances[recipient] += amount;
    emit Transfer(sender, recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) external view returns(uint256){
    return allowances[owner][spender];
  }
  
  // Добавить адрес в параметрах
  function mint(uint256 amount, address to) internal {
    balances[to] += amount;
    _totalSupply += amount;
    emit Transfer(address(0), to, amount);
  }

  function burn(uint256 amount, address from) internal {
    balances[from] -= amount;
    _totalSupply -= amount;
    emit Transfer(from,  address(0), amount);
  }


}