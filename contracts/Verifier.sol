//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.5
//      fixed linter warnings
//      added requiere error messages
//
pragma solidity ^0.6.7;

library Pairing {
    struct G1Point {
        uint256 X;
        uint256 Y;
    }
    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint256[2] X;
        uint256[2] Y;
    }

    /// @return the generator of G1
    function P1() internal pure returns (G1Point memory) {
        return G1Point(1, 2);
    }

    /// @return the generator of G2
    function P2() internal pure returns (G2Point memory) {
        // Original code point
        return
            G2Point(
                [
                    11559732032986387107991004021392285783925812861821192530917403151452391805634,
                    10857046999023057135944570762232829481370756359578518086990519993285655852781
                ],
                [
                    4082367875863433681332203403145435568316851327593401208105741076214120093531,
                    8495653923123431417604973247489272438418190587263600148770280649306958101930
                ]
            );

        /*
        // Changed by Jordi point
        return G2Point(
            [10857046999023057135944570762232829481370756359578518086990519993285655852781,
             11559732032986387107991004021392285783925812861821192530917403151452391805634],
            [8495653923123431417604973247489272438418190587263600148770280649306958101930,
             4082367875863433681332203403145435568316851327593401208105741076214120093531]
        );
*/
    }

    /// @return r the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negate(G1Point memory p) internal pure returns (G1Point memory r) {
        // The prime q in the base field F_q for G1


            uint256 q
         = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        if (p.X == 0 && p.Y == 0) return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }

    /// @return r the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2)
        internal
        view
        returns (G1Point memory r)
    {
        uint256[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
                case 0 {
                    invalid()
                }
        }
        require(success, "pairing-add-failed");
    }

    /// @return r the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalar_mul(G1Point memory p, uint256 s)
        internal
        view
        returns (G1Point memory r)
    {
        uint256[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
                case 0 {
                    invalid()
                }
        }
        require(success, "pairing-mul-failed");
    }

    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2)
        internal
        view
        returns (bool)
    {
        require(p1.length == p2.length, "pairing-lengths-failed");
        uint256 elements = p1.length;
        uint256 inputSize = elements * 6;
        uint256[] memory input = new uint256[](inputSize);
        for (uint256 i = 0; i < elements; i++) {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
            input[i * 6 + 2] = p2[i].X[0];
            input[i * 6 + 3] = p2[i].X[1];
            input[i * 6 + 4] = p2[i].Y[0];
            input[i * 6 + 5] = p2[i].Y[1];
        }
        uint256[1] memory out;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(
                sub(gas(), 2000),
                8,
                add(input, 0x20),
                mul(inputSize, 0x20),
                out,
                0x20
            )
            // Use "invalid" to make gas estimation work
            switch success
                case 0 {
                    invalid()
                }
        }
        require(success, "pairing-opcode-failed");
        return out[0] != 0;
    }

    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }

    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](3);
        G2Point[] memory p2 = new G2Point[](3);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        return pairing(p1, p2);
    }

    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2,
        G1Point memory d1,
        G2Point memory d2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](4);
        G2Point[] memory p2 = new G2Point[](4);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p1[3] = d1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        p2[3] = d2;
        return pairing(p1, p2);
    }
}

library Verifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    function initVerifyingKey()
        internal
        pure
        returns (VerifyingKey memory vk)
    {
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([5208981294738493134430483796371379007875494625561407819698076820019454250616,1502642785333200183096715999423950460266189621980647073123808757309153555344], [14876184638580207493433418555710938788766760345900685812288915491408242619312,16742235574983803566759145691434606560098179215881087071580464932370066176816]);
        vk.IC = new Pairing.G1Point[](4);
        vk.IC[0] = Pairing.G1Point(14578143661182793455113076651623054003273722188590815108985065335349975575381,13267047660976491485454880972865146818189355707624820086483614967869609086087);
        vk.IC[1] = Pairing.G1Point(14744557418945621669548369633403761004629046199815881491550774213795434723374,1493533935145274068151878535294148061969309503195007211807118866467576294632);
        vk.IC[2] = Pairing.G1Point(18637699261702812658999184410646693235921825086251004298468363089106525793198,18331397124260050904533229190240328841967851319726257827766347824004806077242);
        vk.IC[3] = Pairing.G1Point(19912705120468631117393054254925338822326203771588127686329377159626379293797,17569643628775190990825122156096549169858283641563095560464357832624651565433);

    }

    function moveVerifyingKey()
        internal
        pure
        returns (VerifyingKey memory vk) { 
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([16228159801101373448128982441110883590169014049733230849872816785396113400974,16753394036458948839323361900484959230236049901934402912629380281261170177722], [10212469694561563408656015965709498608567586265446630768402487739066190625959,12680159348346087522541539078958299611275459621910788102615629454067401518353]);
        vk.IC = new Pairing.G1Point[](6);
        vk.IC[0] = Pairing.G1Point(12421492364930958487400295925493674187136379923696620763811197031685290372009,21804003493752448545631586099270965426093731657189086760961886853611850777866);
        vk.IC[1] = Pairing.G1Point(1634564103516813645846551136946500446487938416207657730925687440969409170559,209073990823700055691156997105876607430878995734532756899714987954192983444);
        vk.IC[2] = Pairing.G1Point(20945441579142228103692551630851929231661342966730099859321218033877282414291,8885532203088298342554751196050744339561913149771989270647739222060940129821);
        vk.IC[3] = Pairing.G1Point(20909212827838880538506428290591612767990208055039770649742902299410305175769,2933342874155871082147181997474143314339845263963961837585636235917833217024);
        vk.IC[4] = Pairing.G1Point(708107087863311477299796610313051876300473313740847010295794976874747050716,20131921098939119250388831890645622136984614652049451305901278250503405933254);
        vk.IC[5] = Pairing.G1Point(1252955455410646847547290622371782391807133027593457360792219907305480805320,8407538809222977903823914728864833217263974211771777560227777333699301298723);

    }

    function biomebaseVerifyingKey()
        internal
        pure
        returns (VerifyingKey memory vk) { 
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([13736745393511757083728911656656680545842513551269771849998101645756682865980,1153062763297694779508518237472834837550859138230601411349390085865208724755], [6513602531557181271129019382805540431371771588367256339784864011270807319582,39236155161050838677102188671603763034961271527003585946923619261026686357]);
        vk.IC = new Pairing.G1Point[](3);
        vk.IC[0] = Pairing.G1Point(4420680676741070834256191825200522436343891278154986157574299719293859473872,7947472686438781292633236091375788784277023973218420407111291159691764090345);
        vk.IC[1] = Pairing.G1Point(21413865639424688002704774840675986126240576995440597481968581385498246032131,958999121646112062303206531001318086404394261795065370829004595010705853772);
        vk.IC[2] = Pairing.G1Point(4707766087517964860627225885995720540989139785365054049656946232903151497197,8964476457614950599968403658478664622412701430110418520897783042629845650107);

    }

    function verify(
        uint256[] memory input,
        Proof memory proof,
        VerifyingKey memory vk
    ) internal view returns (uint256) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        require(input.length + 1 == vk.IC.length, "verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint256 i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field, "verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (
            !Pairing.pairingProd4(
                Pairing.negate(proof.A),
                proof.B,
                vk.alfa1,
                vk.beta2,
                vk_x,
                vk.gamma2,
                proof.C,
                vk.delta2
            )
        ) return 1;
        return 0;
    }

    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input,
        VerifyingKey memory vk
    ) internal view returns (bool) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        if (verify(input, proof, vk) == 0) {
            return true;
        } else {
            return false;
        }
    }

    function verifyInitProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[3] memory input
    ) public view returns (bool) {
        uint256[] memory inputValues = new uint256[](input.length);
        for (uint256 i = 0; i < input.length; i++) {
            inputValues[i] = input[i];
        }
        return verifyProof(a, b, c, inputValues, initVerifyingKey());
    }

    function verifyMoveProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[5] memory input
    ) public view returns (bool) {
        uint256[] memory inputValues = new uint256[](input.length);
        for (uint256 i = 0; i < input.length; i++) {
            inputValues[i] = input[i];
        }
        return verifyProof(a, b, c, inputValues, moveVerifyingKey());
    }

    function verifyBiomebaseProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[2] memory input
    ) public view returns (bool) {
        uint256[] memory inputValues = new uint256[](input.length);
        for (uint256 i = 0; i < input.length; i++) {
            inputValues[i] = input[i];
        }
        return verifyProof(a, b, c, inputValues, biomebaseVerifyingKey());
    }
}
