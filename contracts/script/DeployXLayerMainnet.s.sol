// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/AddressBook.sol";
import "../src/core/BatchSettler.sol";
import "../src/core/Controller.sol";
import "../src/core/MarginPool.sol";
import "../src/core/OTokenFactory.sol";
import "../src/core/Oracle.sol";
import "../src/core/Whitelist.sol";

/**
 * @title DeployXLayerMainnet
 * @notice Deploys the options protocol to X Layer mainnet using xETH/USDt0.
 *
 *         Mirrors the Base mainnet deployment shape:
 *         - 7 UUPS implementations
 *         - 7 ERC1967 proxies
 *         - AddressBook wiring
 *         - xETH/USDt0 whitelist
 *         - Chainlink ETH/USD oracle
 *         - Aave V3 flash loans + Uniswap V3 physical delivery
 *
 *         Usage:
 *         forge script script/DeployXLayerMainnet.s.sol:DeployXLayerMainnet \
 *           --rpc-url $XLAYER_MAINNET_RPC_URL \
 *           --ledger --sender $DEPLOYER_ADDRESS \
 *           --broadcast --slow -vvvv
 */
contract DeployXLayerMainnet is Script {
    address internal constant XETH = 0xE7B000003A45145decf8a28FC755aD5eC5EA025A;
    address internal constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address internal constant CHAINLINK_ETH_USD = 0x8b85b50535551F8E8cDAF78dA235b5Cf1005907b;

    address internal constant AAVE_V3_POOL = 0xE3F3Caefdd7180F884c01E57f65Df979Af84f116;
    address internal constant UNISWAP_SWAP_ROUTER = 0x4f0C28f5926AFDA16bf2506D5D9e57Ea190f9bcA;
    address internal constant A_XETH = 0xe6639ba6c1d79Be6d4c776E4c17504538d1719cD;
    address internal constant A_USDT0 = 0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297;

    uint24 internal constant XETH_USDT0_FEE_TIER = 500;
    uint8 internal constant XETH_DECIMALS = 18;
    uint8 internal constant USDT0_DECIMALS = 6;

    struct DeployedImplementations {
        AddressBook addressBook;
        Controller controller;
        MarginPool marginPool;
        OTokenFactory oTokenFactory;
        Oracle oracle;
        Whitelist whitelist;
        BatchSettler batchSettler;
    }

    struct DeployedProxies {
        AddressBook addressBook;
        Controller controller;
        MarginPool marginPool;
        OTokenFactory oTokenFactory;
        Oracle oracle;
        Whitelist whitelist;
        BatchSettler batchSettler;
    }

    function run() external {
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address deployer = msg.sender;

        address xeth = vm.envOr("XETH_ADDRESS", XETH);
        address usdt0 = vm.envOr("USDT0_ADDRESS", USDT0);
        address chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD_FEED", CHAINLINK_ETH_USD);

        vm.startBroadcast();

        DeployedImplementations memory impls = _deployImplementations();
        DeployedProxies memory proxies = _deployProxies(impls, deployer, operator);

        _wireAddressBook(proxies);
        _configureCore(proxies, operator, xeth, usdt0, chainlinkEthUsd);
        _configurePhysicalDelivery(proxies.batchSettler, xeth);
        _configureOptionalAaveYield(proxies.marginPool, operator, xeth, usdt0);

        vm.stopBroadcast();

        _logSummary(impls, proxies, operator, xeth, usdt0, chainlinkEthUsd);
    }

    function _deployImplementations() internal returns (DeployedImplementations memory impls) {
        impls.addressBook = new AddressBook();
        impls.controller = new Controller();
        impls.marginPool = new MarginPool();
        impls.oTokenFactory = new OTokenFactory();
        impls.oracle = new Oracle();
        impls.whitelist = new Whitelist();
        impls.batchSettler = new BatchSettler();
    }

    function _deployProxies(DeployedImplementations memory impls, address deployer, address operator)
        internal
        returns (DeployedProxies memory proxies)
    {
        proxies.addressBook = AddressBook(
            address(new ERC1967Proxy(address(impls.addressBook), abi.encodeCall(AddressBook.initialize, (deployer))))
        );
        proxies.controller = Controller(
            address(
                new ERC1967Proxy(
                    address(impls.controller),
                    abi.encodeCall(Controller.initialize, (address(proxies.addressBook), deployer))
                )
            )
        );
        proxies.marginPool = MarginPool(
            address(
                new ERC1967Proxy(
                    address(impls.marginPool), abi.encodeCall(MarginPool.initialize, (address(proxies.addressBook)))
                )
            )
        );
        proxies.oTokenFactory = OTokenFactory(
            address(
                new ERC1967Proxy(
                    address(impls.oTokenFactory),
                    abi.encodeCall(OTokenFactory.initialize, (address(proxies.addressBook)))
                )
            )
        );
        proxies.oracle = Oracle(
            address(
                new ERC1967Proxy(
                    address(impls.oracle), abi.encodeCall(Oracle.initialize, (address(proxies.addressBook), deployer))
                )
            )
        );
        proxies.whitelist = Whitelist(
            address(
                new ERC1967Proxy(
                    address(impls.whitelist),
                    abi.encodeCall(Whitelist.initialize, (address(proxies.addressBook), deployer))
                )
            )
        );
        proxies.batchSettler = BatchSettler(
            address(
                new ERC1967Proxy(
                    address(impls.batchSettler),
                    abi.encodeCall(BatchSettler.initialize, (address(proxies.addressBook), operator, deployer))
                )
            )
        );
    }

    function _wireAddressBook(DeployedProxies memory proxies) internal {
        proxies.addressBook.setController(address(proxies.controller));
        proxies.addressBook.setMarginPool(address(proxies.marginPool));
        proxies.addressBook.setOTokenFactory(address(proxies.oTokenFactory));
        proxies.addressBook.setOracle(address(proxies.oracle));
        proxies.addressBook.setWhitelist(address(proxies.whitelist));
        proxies.addressBook.setBatchSettler(address(proxies.batchSettler));
    }

    function _configureCore(
        DeployedProxies memory proxies,
        address operator,
        address xeth,
        address usdt0,
        address chainlinkEthUsd
    ) internal {
        proxies.oTokenFactory.setOperator(operator);
        proxies.oracle.setOperator(operator);

        address mmAddress = vm.envOr("MM_ADDRESS", operator);
        proxies.batchSettler.setWhitelistedMM(mmAddress, true);

        proxies.whitelist.whitelistUnderlying(xeth);
        proxies.whitelist.whitelistCollateral(usdt0);
        proxies.whitelist.whitelistCollateral(xeth);
        proxies.whitelist.whitelistProduct(xeth, usdt0, usdt0, true);
        proxies.whitelist.whitelistProduct(xeth, usdt0, xeth, false);

        proxies.oracle.setPriceFeed(xeth, chainlinkEthUsd);
        _configureOracleSafety(proxies.oracle);
        _configureProtocolFee(proxies.batchSettler);

        uint256 escapeDelay = vm.envOr("ESCAPE_DELAY", uint256(3 days));
        proxies.batchSettler.setEscapeDelay(escapeDelay);

        proxies.controller.setPartialPauser(operator);
    }

    function _configureProtocolFee(BatchSettler settler) internal {
        address treasury = vm.envOr("TREASURY_ADDRESS", address(0));
        uint256 feeBps = vm.envOr("PROTOCOL_FEE_BPS", uint256(400));

        if (treasury != address(0)) {
            settler.setTreasury(treasury);
        }
        if (feeBps > 0) {
            settler.setProtocolFeeBps(feeBps);
        }
    }

    function _configureOracleSafety(Oracle oracle) internal {
        uint256 deviationBps = vm.envOr("PRICE_DEVIATION_THRESHOLD_BPS", uint256(1000));
        uint256 staleness = vm.envOr("MAX_ORACLE_STALENESS", uint256(3600));

        oracle.setPriceDeviationThreshold(deviationBps);
        oracle.setMaxOracleStaleness(staleness);
    }

    function _configurePhysicalDelivery(BatchSettler settler, address xeth) internal {
        address aavePool = vm.envOr("AAVE_POOL_ADDRESS", AAVE_V3_POOL);
        address router = vm.envOr("UNISWAP_SWAP_ROUTER", UNISWAP_SWAP_ROUTER);
        uint24 feeTier = uint24(vm.envOr("SWAP_FEE_TIER", uint256(XETH_USDT0_FEE_TIER)));

        settler.setAavePool(aavePool);
        settler.setSwapRouter(router);
        settler.setSwapFeeTier(feeTier);
        settler.setAssetSwapFeeTier(xeth, feeTier);
    }

    function _configureOptionalAaveYield(MarginPool pool, address operator, address xeth, address usdt0) internal {
        bool configureAaveYield = vm.envOr("CONFIGURE_MARGIN_POOL_AAVE", false);
        if (!configureAaveYield) return;

        address aavePool = vm.envOr("AAVE_POOL_ADDRESS", AAVE_V3_POOL);
        address yieldRecipient = vm.envOr("YIELD_RECIPIENT", operator);
        address aXeth = vm.envOr("A_XETH_ADDRESS", A_XETH);
        address aUsdt0 = vm.envOr("A_USDT0_ADDRESS", A_USDT0);

        pool.setAavePool(aavePool);
        pool.setYieldRecipient(yieldRecipient);
        pool.setOperator(operator);
        pool.setAToken(xeth, aXeth);
        pool.setAToken(usdt0, aUsdt0);
        pool.approveAave(xeth);
        pool.approveAave(usdt0);

        bool enableAaveYield = vm.envOr("ENABLE_MARGIN_POOL_AAVE", false);
        if (enableAaveYield) {
            pool.setAaveEnabled(xeth, true);
            pool.setAaveEnabled(usdt0, true);
        }
    }

    function _logSummary(
        DeployedImplementations memory impls,
        DeployedProxies memory proxies,
        address operator,
        address xeth,
        address usdt0,
        address chainlinkEthUsd
    ) internal pure {
        console.log("IMPLEMENTATION:AddressBook:%s", address(impls.addressBook));
        console.log("IMPLEMENTATION:Controller:%s", address(impls.controller));
        console.log("IMPLEMENTATION:MarginPool:%s", address(impls.marginPool));
        console.log("IMPLEMENTATION:OTokenFactory:%s", address(impls.oTokenFactory));
        console.log("IMPLEMENTATION:Oracle:%s", address(impls.oracle));
        console.log("IMPLEMENTATION:Whitelist:%s", address(impls.whitelist));
        console.log("IMPLEMENTATION:BatchSettler:%s", address(impls.batchSettler));

        console.log("DEPLOYED:AddressBook:%s", address(proxies.addressBook));
        console.log("DEPLOYED:Controller:%s", address(proxies.controller));
        console.log("DEPLOYED:MarginPool:%s", address(proxies.marginPool));
        console.log("DEPLOYED:OTokenFactory:%s", address(proxies.oTokenFactory));
        console.log("DEPLOYED:Oracle:%s", address(proxies.oracle));
        console.log("DEPLOYED:Whitelist:%s", address(proxies.whitelist));
        console.log("DEPLOYED:BatchSettler:%s", address(proxies.batchSettler));

        console.log("CONFIG:Operator:%s", operator);
        console.log("CONFIG:XETH:%s", xeth);
        console.log("CONFIG:USDT0:%s", usdt0);
        console.log("CONFIG:ChainlinkETHUSD:%s", chainlinkEthUsd);
        console.log("CONFIG:XETHDecimals:%s", XETH_DECIMALS);
        console.log("CONFIG:USDT0Decimals:%s", USDT0_DECIMALS);
    }
}
