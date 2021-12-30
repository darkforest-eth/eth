// SPDX-License-Identifier: MIT
// THIS FILE IS GENERATED BY HARDHAT-CIRCOM. DO NOT EDIT THIS FILE.

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
pragma solidity ^0.8.0;

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

   
      function initVerifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([12599857379517512478445603412764121041984228075771497593287716170335433683702,7912208710313447447762395792098481825752520616755888860068004689933335666613], [11502426145685875357967720478366491326865907869902181704031346886834786027007,21679208693936337484429571887537508926366191105267550375038502782696042114705]);
        vk.IC = new Pairing.G1Point[](9);
      vk.IC[0] = Pairing.G1Point(1598626181488966834385142702072340632701729613588553898141479831063364046244,17718230806281540722028825298558518558905695159801697318226319873036301566727);
        vk.IC[1] = Pairing.G1Point(15948659782990752942887133907536447435191600109534617758082114399428869442993,11099101392431127819059666871299914860584228203768799086923186847076507315534);
        vk.IC[2] = Pairing.G1Point(13186007044390084081960383089914876934734527345381844648722866901270835430043,12363602961009028954516007109103956695133402002489551690760572271217053348325);
        vk.IC[3] = Pairing.G1Point(19033951188675203289309544100203877456200968413799602644605085592542868603150,4102643274799727974772046308975344678795771407725941358248723363344896703834);
        vk.IC[4] = Pairing.G1Point(12334287564680926687012264573398090483137523358397833233474322750256715605363,21152252948357751342019470982759350534775883984606520773786839787341259892071);
        vk.IC[5] = Pairing.G1Point(7267767678980834682497060995607083951430815719518946230330975730812172227169,10805676519882027813209103871655027576122630931197256609570718268993985006376);
        vk.IC[6] = Pairing.G1Point(756398625131320539711001637394523340428095665700281242919581685489287926359,1432850884206501416882319922791827723541173896617346816668465291785770862113);
        vk.IC[7] = Pairing.G1Point(16222995936446875092505443491296436794133479486403641167081751292555012163485,1455297279126108200908824339804743093067568793093720522966758475516874759095);
        vk.IC[8] = Pairing.G1Point(8068157216405939054553967344367105009755284398919359918024675691332040416938,4244594119739321487311315399210137890665530536229170011371323025231638521760);

      }

      function verifyInitProof(
          uint256[2] memory a,
          uint256[2][2] memory b,
          uint256[2] memory c,
          uint256[8] memory input
      ) public view returns (bool) {
          uint256[] memory inputValues = new uint256[](input.length);
          for (uint256 i = 0; i < input.length; i++) {
              inputValues[i] = input[i];
          }
          return verifyProof(a, b, c, inputValues, initVerifyingKey());
      }
      function moveVerifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([2265134844274426723457876006698460249939887303444156597934859108326277795744,1040851089387492326804450273946202637694128127443277238653689255686985312604], [5432521204675740697545698160262696877452493693467957694849729723272205209808,4388453581474445742202278919193380632481770898177871444044785283573024395786]);
        vk.IC = new Pairing.G1Point[](11);
      vk.IC[0] = Pairing.G1Point(14177816537775685783067647996272395454522594113428919821714589771180610568314,6823299126837656023989613525270949531672774579800418483384480496108911392326);
        vk.IC[1] = Pairing.G1Point(11585636782253030502414616875647660216631207697186549464738288453964312644262,16366617865324088972494410389765901462344692803975117494865461021515474079688);
        vk.IC[2] = Pairing.G1Point(8526293419624642441177611861266522564535442436561010348205944152133493162725,3479280449869946130511008755784252400013835433175598584791748314213410764833);
        vk.IC[3] = Pairing.G1Point(21182306298733068802820987158927230646638198417426291669144906447401618501713,16857746536545121121722827547496248151726638134940849621125320491891019025167);
        vk.IC[4] = Pairing.G1Point(2422158897289367980628558882683834680415851035494328775832566189908899480990,12290959329104925151330970367392351311606695561220408091718189761494318064737);
        vk.IC[5] = Pairing.G1Point(14091123445468389490984207968580529389285084523867074029328088750965597860725,9831488985832734488154360211536506542169099577306406169097418473025517821329);
        vk.IC[6] = Pairing.G1Point(16445937071709775127014464296805598101804177189603496295471720227462382717347,4257908787851211693924711039278073775698061556838306726249941622502409880895);
        vk.IC[7] = Pairing.G1Point(2766052651699970673595522419922354631408983259020045659871321649957749349073,3732505317526081965855612226411538764427039525359657450926165933268597125283);
        vk.IC[8] = Pairing.G1Point(17233592675629634419200196145316755628670556232520782320233523232711382989921,16401047366370778891859017839585544849894561508054482340206879604080013075589);
        vk.IC[9] = Pairing.G1Point(12899954474854513958627186382599164812395305621088734318137043197938133454904,15811974815112357990644545933308745133005809603635712309967428804883434830922);
        vk.IC[10] = Pairing.G1Point(21812100923578770879826789010734173923255464631245969568191253280985041128149,12314097111841921359975277319096158327979548278096386657740352862403817415500);

      }

      function verifyMoveProof(
          uint256[2] memory a,
          uint256[2][2] memory b,
          uint256[2] memory c,
          uint256[10] memory input
      ) public view returns (bool) {
          uint256[] memory inputValues = new uint256[](input.length);
          for (uint256 i = 0; i < input.length; i++) {
              inputValues[i] = input[i];
          }
          return verifyProof(a, b, c, inputValues, moveVerifyingKey());
      }
      function biomebaseVerifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([2265134844274426723457876006698460249939887303444156597934859108326277795744,1040851089387492326804450273946202637694128127443277238653689255686985312604], [5432521204675740697545698160262696877452493693467957694849729723272205209808,4388453581474445742202278919193380632481770898177871444044785283573024395786]);
        vk.IC = new Pairing.G1Point[](8);
      vk.IC[0] = Pairing.G1Point(10870898939986000468532157640231430092356116495039287249548370970435589722710,9637509233802404751050875244565641105864732921095328155747707264762895963694);
        vk.IC[1] = Pairing.G1Point(19138797608808993399657283067430257583053688297164578482098293101955262780551,20006287987513927804142618424385437530171110155612987617518879163008364014606);
        vk.IC[2] = Pairing.G1Point(17304007468441180997716244116520857563533809761218985626293522053908493505090,10661203918282053275945646230942620946002534084451026282622270452943585743628);
        vk.IC[3] = Pairing.G1Point(5181667818968093211184395989107723147946357135951722771133753482206625520900,11524527376858057226628998684496272859392684007522465415165954702519865828117);
        vk.IC[4] = Pairing.G1Point(17192955364137903388262743076349494417862980178304217509477182339251823772568,1297765320043384539164468564266822437321156243704102639733266255573124340903);
        vk.IC[5] = Pairing.G1Point(10223100098263004543650712184609427216924158269417508893671387153093361071201,16408208689150722063534888081513556099136868964465929786411791500332917323462);
        vk.IC[6] = Pairing.G1Point(16330316096802937034884680265434329009343791504275494295174062987766625024764,1164322360402761791124865688052966126182332573510444462379337183432065129108);
        vk.IC[7] = Pairing.G1Point(19626050859393228947262712902621918433394532884263841107770577683375588382396,8725631736685333716057959034030692087034116048366612534073131375249589821104);

      }

      function verifyBiomebaseProof(
          uint256[2] memory a,
          uint256[2][2] memory b,
          uint256[2] memory c,
          uint256[7] memory input
      ) public view returns (bool) {
          uint256[] memory inputValues = new uint256[](input.length);
          for (uint256 i = 0; i < input.length; i++) {
              inputValues[i] = input[i];
          }
          return verifyProof(a, b, c, inputValues, biomebaseVerifyingKey());
      }
      function revealVerifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(19642524115522290447760970021746675789341356000653265441069630957431566301675,15809037446102219312954435152879098683824559980020626143453387822004586242317);
        vk.beta2 = Pairing.G2Point([6402738102853475583969787773506197858266321704623454181848954418090577674938,3306678135584565297353192801602995509515651571902196852074598261262327790404], [15158588411628049902562758796812667714664232742372443470614751812018801551665,4983765881427969364617654516554524254158908221590807345159959200407712579883]);
        vk.gamma2 = Pairing.G2Point([11559732032986387107991004021392285783925812861821192530917403151452391805634,10857046999023057135944570762232829481370756359578518086990519993285655852781], [4082367875863433681332203403145435568316851327593401208105741076214120093531,8495653923123431417604973247489272438418190587263600148770280649306958101930]);
        vk.delta2 = Pairing.G2Point([2265134844274426723457876006698460249939887303444156597934859108326277795744,1040851089387492326804450273946202637694128127443277238653689255686985312604], [5432521204675740697545698160262696877452493693467957694849729723272205209808,4388453581474445742202278919193380632481770898177871444044785283573024395786]);
        vk.IC = new Pairing.G1Point[](10);
      vk.IC[0] = Pairing.G1Point(11550964137187913352526724844580499338131382138893314699756753981006102732019,19492512945047869932948946467344653872184411292565776553305249475937323729280);
        vk.IC[1] = Pairing.G1Point(3916477035785360610976006321745916078968774369440543915902405954859488657313,15321034048954067345112787429494548298867833228473430687967681199888641151218);
        vk.IC[2] = Pairing.G1Point(17162424485303597880607912676313480248024835510544797888250705764698557232067,19453235390127677713226294656715961366017915707222166147386013146796174344100);
        vk.IC[3] = Pairing.G1Point(18090371915074528950280328905230849072316392894197745679334457442299133449430,19524426570088492708850338768755752233034279721987555793648652517882432064517);
        vk.IC[4] = Pairing.G1Point(767631375883993792557482575516315588178749917872688074294429711943701764800,9024881774954499373094479803427980260507719201893300903117449305794276264316);
        vk.IC[5] = Pairing.G1Point(12088035103643715261503541268257878836906149422260983576825564118730422949354,4040793404454834725203304217288744180770767408377168750569518446821652967704);
        vk.IC[6] = Pairing.G1Point(2328288820829950612851495588333276395021985013772071429590313403196629336635,17318279807071387752527161519317163444818989114365031734312444168421406733803);
        vk.IC[7] = Pairing.G1Point(508886213136770041992297650970372239109587151166819911780283404042598828207,21459755540335687717195867547576680711316868768415756597122982205242595749624);
        vk.IC[8] = Pairing.G1Point(16403757598191581045783542370732218264722652182053301183354635728787150188596,12346140666653289251922737241759179245576250396348329174203588462438356208443);
        vk.IC[9] = Pairing.G1Point(11402597413800839700634162913764544661317059412989909428143599812990631376392,18128684448300585236997388740896244971475725654191963688383260132795174539587);

      }

      function verifyRevealProof(
          uint256[2] memory a,
          uint256[2][2] memory b,
          uint256[2] memory c,
          uint256[9] memory input
      ) public view returns (bool) {
          uint256[] memory inputValues = new uint256[](input.length);
          for (uint256 i = 0; i < input.length; i++) {
              inputValues[i] = input[i];
          }
          return verifyProof(a, b, c, inputValues, revealVerifyingKey());
      }
}
