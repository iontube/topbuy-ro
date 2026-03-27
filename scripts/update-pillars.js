import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_PATH = join(ROOT, 'public', 'data', 'content', 'seo-content.json');

const d = JSON.parse(readFileSync(CONTENT_PATH, 'utf-8'));

const pillars = {

"electronice-it": {
  metaTitle: "Electronice si IT - Ghid complet de achizitii | TopBuy.ro",
  metaDescription: "Compara peste 88.000 de produse electronice si IT de la magazine verificate. Laptopuri, telefoane, televizoare, casti si accesorii cu preturi actualizate zilnic.",
  h1: "Electronice si IT",
  intro: `Pe TopBuy.ro gasesti peste 88.000 de produse din zona de electronice si IT, adunate de la zeci de magazine romanesti. Laptopuri, telefoane, televizoare, casti, monitoare, componente PC, periferice si o gramada de accesorii - toate intr-un singur loc, cu preturi actualizate.
Categoria asta acopera tot ce tine de tehnologie, de la un SSD de 50 de lei pana la un laptop gaming de 10.000. Am organizat produsele pe subcategorii clare si am creat ghiduri pentru cele mai cautate tipuri de produse, ca sa nu pierzi timp comparand 15 taburi in browser.
Daca stii deja ce vrei, cauta direct in subcategoriile de mai jos. Daca nu esti sigur, ghidurile de tip "cele mai bune" sau "top" te ajuta sa vezi ce se merita la bugetul tau. Fiecare ghid are produse filtrate, sortate si verificate ca exista pe stoc.`,
  tips: [
    "Verifica specificatiile exacte pe site-ul magazinului inainte de comanda. Titlurile din feeduri nu contin intotdeauna toate detaliile tehnice.",
    "La laptopuri, rezolutia ecranului si tipul de stocare (SSD vs HDD) conteaza mai mult decat procesorul pentru utilizarea zilnica.",
    "La televizoare, nu te uita doar la diagonala. Tipul panoului (OLED, QLED, IPS) face diferenta reala in calitatea imaginii.",
    "Castile wireless cu Bluetooth 5.0+ au o conexiune mult mai stabila si consum redus de baterie fata de versiunile mai vechi.",
    "La componente PC, verifica compatibilitatea intre placa de baza, procesor si memorie RAM inainte de comanda."
  ],
  faq: [
    {q: "Cat de des se actualizeaza preturile?", a: "Preturile se actualizeaza zilnic din feedurile magazinelor partenere. Pretul final il vezi intotdeauna pe site-ul magazinului."},
    {q: "Pot comanda direct de pe TopBuy.ro?", a: "Nu, TopBuy.ro este un site de comparare. Cand gasesti un produs care te intereseaza, esti redirectionat catre magazinul care il vinde."},
    {q: "De ce unele produse nu au pret afisat?", a: "Unele magazine nu includ pretul in feed sau il actualizeaza mai rar. In aceste cazuri, apasa pe produs pentru a vedea pretul curent pe site-ul magazinului."},
    {q: "Ce inseamna magazin verificat?", a: "Toate magazinele listate pe TopBuy.ro sunt partenere 2Performant, o platforma de afiliere din Romania care verifica magazinele inainte de listare."},
    {q: "Cum aleg un laptop bun sub 3000 lei?", a: "Cauta un model cu procesor AMD Ryzen 5 sau Intel Core i5, minimum 8GB RAM si SSD de 256GB. Ecranul Full HD (1920x1080) e minimul acceptabil."}
  ]
},

"casa-gradina": {
  metaTitle: "Casa si Gradina - Electrocasnice, mobilier, unelte | TopBuy.ro",
  metaDescription: "Peste 75.000 produse pentru casa si gradina. Aspiratoare, frigidere, masini de spalat, mobilier, unelte de gradina si electrocasnice de la magazine verificate.",
  h1: "Casa si Gradina",
  intro: `Aici gasesti tot ce ai nevoie pentru casa, de la electrocasnicele mari (frigidere, masini de spalat, aer conditionat) pana la lucruri mai mici dar esentiale - espressoare, fierbatoare, aspiratoare. Plus mobilier, saltele, covoare si unelte de gradina.
Avem peste 75.000 de produse din aceasta categorie, de la zeci de magazine. Preturile variaza enorm in functie de magazin si de moment, asa ca merita sa compari inainte de a cumpara. Un frigider sau o masina de spalat e o investitie pe 5-10 ani, deci cateva minute de comparare conteaza.
In ghidurile de mai jos am grupat produsele dupa ce cauta lumea pe Google - aspiratoare robot, friteuze cu aer cald, saltele ortopedice si asa mai departe. Fiecare ghid iti arata optiunile concrete, cu produse reale si preturi actualizate.`,
  tips: [
    "La electrocasnicele mari, verifica intotdeauna clasa energetica. Diferenta la factura de curent intre A si C se simte in luni, nu in ani.",
    "La aspiratoarele robot, puterea de aspirare in Pa (pascali) e mai importanta decat pretul. Un model de 1500Pa curata slab parchetul.",
    "La saltele, greutatea ta conteaza. O saltea memory foam moale e buna pentru cineva de 60kg dar total nepotrivita pentru cineva de 100kg.",
    "La mobilier, masoara spatiul disponibil inainte de comanda. Returul unui dulap e complicat si costisitor.",
    "La friteuze cu aer cald, capacitatea de 3-4 litri e suficienta pentru 2 persoane. Pentru o familie de 4+, mergi pe minim 5 litri."
  ],
  faq: [
    {q: "Cum aleg un aspirator robot bun?", a: "Prioritizeaza puterea de aspirare (minim 2000Pa), autonomia bateriei (minim 90 min) si navigarea cu laser (LiDAR). Modelele cu mop sunt un bonus, dar aspirarea ramane functia principala."},
    {q: "Care e diferenta dintre o combina frigorifica si un frigider side by side?", a: "Combina are congelatorul jos si frigiderul sus, pe o singura coloana. Side by side are doua usi verticale alaturate. Side by side ofera mai mult spatiu dar consuma mai mult si necesita o latime de minim 90cm."},
    {q: "Merita un cuptor incorporabil?", a: "Daca renovezi bucataria, da. Se integreaza in mobilier si de obicei are functii mai avansate. Daca nu renovezi, un cuptor de sine statator face acelasi lucru la pret mai mic."},
    {q: "Ce capacitate trebuie sa aiba o masina de spalat?", a: "Pentru 1-2 persoane, 6-7kg e suficient. Pentru o familie cu copii, 8-9kg. Peste 10kg se justifica doar daca speli des lenjerii de pat sau plapumi."},
    {q: "Cum aleg o canapea extensibila?", a: "Daca poti, testeaz-o. Daca nu, verifica mecanismul de extensie (click-clack e simplu dar mai putin confortabil ca pat, tip lada e mai bun), materialul tapiteriei si dimensiunile in pozitia extinsa."}
  ]
},

"fashion": {
  metaTitle: "Moda si accesorii - Incaltaminte, haine, genti | TopBuy.ro",
  metaDescription: "Peste 78.000 produse de moda. Adidasi, ghete, pantofi, geci, rochii, genti, ceasuri si accesorii de la magazine romanesti verificate.",
  h1: "Fashion - Moda si Accesorii",
  intro: `Peste 78.000 de produse de moda si accesorii, de la incaltaminte si imbracaminte pana la genti, ceasuri si ochelari de soare. Am adunat oferte de la magazine romanesti ca sa poti compara rapid ce gasesti si la ce pret.
Cele mai cautate produse din aceasta categorie sunt incaltamintea (adidasi, ghete, bocanci, sandale) si imbracamintea de sezon (geci de iarna, rochii de vara). Preturile fluctueaza mult in functie de sezon si de reduceri, asa ca merita sa verifici periodic.
Foloseste ghidurile de mai jos daca vrei sa vezi rapid ce optiuni ai la un anumit tip de produs. Am grupat totul dupa cum cauta oamenii pe Google, ca sa gasesti exact ce te intereseaza.`,
  tips: [
    "La adidasi si pantofi, verifica tabelul de marimi al magazinului. Marimea 42 la Nike nu e aceeasi cu 42 la Adidas.",
    "La geci de iarna, gramajul umpluturii conteaza. Sub 200g e o geaca de toamna, nu de iarna. Cauta puf natural cu peste 600 fill power daca vrei caldura la greutate mica.",
    "La genti si rucsacuri, materialul face diferenta. Piele naturala dureaza ani, piele ecologica 1-2 sezoane. Nylonul balistic e aproape indestructibil.",
    "La ceasuri, verifica daca pretul include garantie internationala sau doar garantie magazin.",
    "La ochelari de soare, filtrul UV e mai important decat brandul. Cauta marcajul UV400 pe specificatii."
  ],
  faq: [
    {q: "Cum aleg marimea potrivita la incaltaminte online?", a: "Masoara-ti talpa pe o foaie de hartie si compara cu tabelul de marimi al producatorului. Daca esti intre doua marimi, alege-o pe cea mai mare."},
    {q: "Merita sa cumpar adidasi de brand?", a: "Depinde de utilizare. Pentru alergare sau sport intens, branduri ca Nike, Asics sau New Balance ofera tehnologii specifice. Pentru purtare zilnica, branduri mai putin cunoscute pot oferi raport calitate-pret mai bun."},
    {q: "Cum recunosc o geaca de iarna buna?", a: "Verifica materialul exterior (impermeabil sau nu), tipul de izolatie (puf natural, sintetic), gramajul si temperatura minima recomandata. O geaca buna de iarna are minim 300g izolatie si material exterior rezistent la vant."},
    {q: "Ce tip de geanta e potrivit pentru laptop?", a: "Un rucsac cu compartiment dedicat si captusit pentru laptop. Verifica sa incapa marimea laptopului tau. Rucsacurile cu spate ventilat sunt mai confortabile la purtare indelungata."},
    {q: "Care e diferenta intre piele naturala si piele ecologica?", a: "Pielea naturala respira, se muleaza pe picior si dureaza ani. Pielea ecologica e mai ieftina, impermeabila dar nu respira si se degradeaza in 1-2 ani de utilizare regulata."}
  ]
},

"copii-jucarii": {
  metaTitle: "Copii si Jucarii - Carucioare, scaune auto, jucarii | TopBuy.ro",
  metaDescription: "Peste 93.000 produse pentru copii. Carucioare, scaune auto, biciclete, jucarii educative, LEGO, patuturi si accesorii de la magazine verificate.",
  h1: "Copii si Jucarii",
  intro: `Peste 93.000 de produse pentru copii si bebelusi - de la carucioare si scaune auto pana la jucarii, biciclete, patuturi si accesorii. Produsele vin de la magazine romanesti verificate, cu preturi actualizate zilnic.
Produsele pentru copii sunt printre cele mai importante achizitii, mai ales cand vine vorba de siguranta: scaune auto, carucioare, patuturi. La acestea merita sa investesti in calitate si sa verifici certificarile de siguranta (R44/04 sau i-Size la scaune auto, de exemplu).
La jucarii si articole educative, gama e imensa. Am grupat produsele dupa categorii si varsta orientativa, ca sa gasesti rapid ce e potrivit.`,
  tips: [
    "La scaunele auto, verifica standardul de siguranta. i-Size (R129) e cel mai nou si cel mai sigur.",
    "La carucioare, greutatea conteaza daca locuiesti la bloc fara lift. Un carucior de 15kg pare ok in magazin, dar nu cand il urci pe scari zilnic.",
    "La jucarii, varsta recomandata de pe cutie e orientativa. Cunosti cel mai bine ce poate si ce ii place copilului tau.",
    "La biciclete pentru copii, marimea se alege dupa inaltime, nu dupa varsta.",
    "Verifica intotdeauna daca jucariile au marcajul CE. E obligatoriu in UE si confirma respectarea normelor de siguranta."
  ],
  faq: [
    {q: "Ce carucior sa aleg: 2 in 1 sau 3 in 1?", a: "3 in 1 include si scoica auto, deci e mai economic daca nu ai deja una. 2 in 1 (landou + sportiv) e suficient daca ai deja scoica sau preferi sa o alegi separat."},
    {q: "Pana la ce varsta e obligatoriu scaunul auto?", a: "In Romania, scaunul auto e obligatoriu pana la 150cm inaltime sau 36kg greutate. In practica, majoritatea copiilor au nevoie de scaun pana la 10-12 ani."},
    {q: "Ce LEGO sa cumpar pentru un copil de 5 ani?", a: "Seria LEGO Duplo e pentru 2-5 ani (piese mari). De la 4-5 ani poti trece la LEGO City sau LEGO Classic cu piese standard."},
    {q: "Cum aleg o bicicleta pentru copil?", a: "Masoara inaltimea copilului. 85-100cm = 12 inch, 100-115cm = 14 inch, 115-130cm = 16 inch, 130-145cm = 20 inch. Copilul trebuie sa ajunga cu varfurile picioarelor pe pamant."},
    {q: "Merita o masinuta electrica pentru copii?", a: "E o jucarie distractiva pentru curte sau parc. Verifica autonomia bateriei (minim 1 ora), greutatea maxima suportata si viteza (5-7 km/h e suficient si sigur)."}
  ]
},

"auto-moto": {
  metaTitle: "Auto si Moto - Anvelope, piese, accesorii | TopBuy.ro",
  metaDescription: "Peste 112.000 produse auto si moto. Anvelope, jante, uleiuri, piese de schimb si accesorii auto de la magazine verificate din Romania.",
  h1: "Auto si Moto",
  intro: `Peste 112.000 de produse auto si moto - anvelope, jante, uleiuri, filtre, acumulatoare, accesorii si piese de schimb. Preturile se actualizeaza zilnic din ofertele magazinelor partenere.
Anvelopele sunt produsul cel mai cautat in aceasta categorie, si pe buna dreptate - e una dintre putinele piese auto pe care o schimbi regulat si unde pretul variaza enorm. Acelasi set de anvelope poate avea diferente de 200-300 lei intre magazine.
Am grupat produsele pe tipuri si dimensiuni, inclusiv cele mai cautate dimensiuni de anvelope (205/55 R16, 195/65 R15, 225/45 R17). Ghidurile iti arata rapid ce optiuni ai la bugetul tau.`,
  tips: [
    "La anvelope, DOT-ul (data fabricatiei) conteaza. O anvelopa fabricata acum mai mult de 3 ani se degradeaza chiar daca nu a fost folosita.",
    "Uleiul motor trebuie sa respecte specificatia din cartea masinii. Un 5W30 nu e intotdeauna interschimbabil cu un 5W40.",
    "La jante de aliaj, verifica PCD-ul, ET-ul (offset) si diametrul butucului. Nu toate jantele se potrivesc pe orice masina.",
    "La bateriile auto, capacitatea (Ah) si curentul de pornire (CCA) trebuie sa fie egale sau mai mari decat cele originale.",
    "Filtrele de ulei si aer se schimba la fiecare revizie. Pretul lor e mic dar impactul asupra motorului e mare."
  ],
  faq: [
    {q: "Cand trebuie sa schimb anvelopele de vara cu cele de iarna?", a: "Cand temperatura medie scade constant sub 7 grade Celsius, de obicei in noiembrie. Legislatia romaneasca impune anvelope de iarna pe drumuri acoperite cu zapada sau gheata, nu la o data fixa."},
    {q: "Anvelope all season sau sezoniere?", a: "All season sunt un compromis - acceptabile in orice conditii dar nu excelente in niciuna. Pentru ierni usoare si drum de oras, pot fi ok. Pentru zapada multa sau munte, sezonierele sunt mai sigure."},
    {q: "Cum verific daca o janta se potriveste pe masina mea?", a: "Ai nevoie de: diametrul (R16), PCD (5x112), ET/offset (ET45) si diametrul butucului (57.1mm). Le gasesti in cartea masinii sau pe jantele originale."},
    {q: "Ce ulei motor sa folosesc?", a: "Vascozitatea si specificatia sunt in cartea tehnica a masinii. Nu te ghida dupa pret sau brand, ci dupa compatibilitate."},
    {q: "Cat de des trebuie schimbata bateria auto?", a: "In medie la 4-5 ani. Daca masina porneste greu dimineata sau farurile sunt mai slabe la ralanti, bateria probabil e la final."}
  ]
},

"sport": {
  metaTitle: "Sport si fitness - Biciclete, trotinete, echipamente | TopBuy.ro",
  metaDescription: "Peste 44.000 produse sport si fitness. Biciclete, trotinete electrice, benzi de alergat, gantere, corturi si echipamente sportive de la magazine verificate.",
  h1: "Sport si Fitness",
  intro: `Peste 44.000 de produse sport si fitness - biciclete, trotinete electrice, echipamente de sala (benzi de alergat, gantere, banci), echipament de camping si accesorii sportive.
Bicicletele si trotinetele electrice sunt cele mai cautate, urmate de echipamentele de fitness pentru acasa. Preturile variaza foarte mult - o bicicleta MTB decenta porneste de la 1500 lei, una de competitie ajunge la 15.000.
Ghidurile de mai jos te ajuta sa compari optiunile rapid, grupate pe tip de produs si buget.`,
  tips: [
    "La biciclete, marimea cadrului se alege dupa inaltimea ta. Cadru prea mare sau prea mic iti afecteaza postura si confortul.",
    "La trotinetele electrice, autonomia reala e cam 60-70% din cea declarata de producator.",
    "La benzile de alergat, motorul (minim 1.5 CP) si suprafata de alergare (minim 120x40cm) sunt mai importante decat viteza maxima.",
    "La gantere, seturile reglabile ocupa mai putin spatiu si te costa mai putin pe termen lung.",
    "La corturile de camping, numarul de persoane declarat e optimist. Un cort de 3 persoane e confortabil pentru 2 cu bagaje."
  ],
  faq: [
    {q: "Ce bicicleta MTB sa aleg pentru un incepator?", a: "Un hardtail cu cadru de aluminiu si frane pe disc. Buget minim 1500-2000 lei pentru ceva decent. Sub acest pret, componentele se strica rapid."},
    {q: "Merita o trotineta electrica pentru naveta?", a: "Da, daca ai sub 10km si drumul e relativ plan. Verifica minim 300W motor, roti de 10 inch si limita legala de 25 km/h."},
    {q: "Ce echipamente de fitness am nevoie acasa?", a: "Minimul: gantere reglabile, o saltea si o bara de tractiuni. Cu acestea poti antrena tot corpul. Banda de alergat adauga cardio dar ocupa spatiu."},
    {q: "Cum aleg un sac de dormit?", a: "Temperatura de confort (nu cea extrema) trebuie sa fie egala sau mai mica decat temperatura minima la care dormi."},
    {q: "Care e diferenta dintre o bicicleta MTB si una de oras?", a: "MTB: suspensie, cauciucuri late, viteze pentru teren accidentat. Oras: cauciucuri subtiri, pozitie dreapta, aparatoare noroi. Pentru naveta pe asfalt, cea de oras e mai eficienta."}
  ]
},

"pescuit": {
  metaTitle: "Pescuit si vanatoare - Lansete, mulinete, echipament | TopBuy.ro",
  metaDescription: "Peste 10.000 produse de pescuit. Lansete, mulinete, naluci, fire, corturi si accesorii de la magazine specializate verificate.",
  h1: "Pescuit si Vanatoare",
  intro: `Peste 10.000 de produse de pescuit si vanatoare - lansete, mulinete, naluci, fire, plumbi, corturi de pescuit, scaune, juvelnice si alte accesorii. Produsele vin de la magazine specializate din Romania.
Pescuitul e un hobby unde echipamentul conteaza, dar nu trebuie sa fie scump ca sa fie bun. O lanseta si o mulineta potrivite pentru tehnica ta fac mai mult decat un set premium folosit gresit.
Am grupat echipamentele pe tehnica de pescuit (feeder, spinning, crap) si pe tipuri de produse, ca sa gasesti rapid ce ai nevoie.`,
  tips: [
    "La lansete, actiunea (fast, medium, slow) se alege in functie de tehnica. Spinning cere fast, feeder cere medium sau slow.",
    "La mulinete, marimea (1000, 2500, 4000) se alege in functie de lanseta si pestele tinta.",
    "La naluci, culoarea conteaza mai putin decat marimea si modul de miscare in apa.",
    "Firul de pescuit trebuie schimbat cel putin o data pe an. UV-ul si apa il degradeaza.",
    "Un scaun bun de pescuit e o investitie subestimata. O zi intreaga pe un scaun prost iti strica placerea."
  ],
  faq: [
    {q: "Ce lanseta sa aleg pentru incepatori?", a: "O lanseta feeder de 3.6m cu actiune medium. Merge la balta si la rau, pe distante medii. Buget: 150-300 lei."},
    {q: "Ce mulineta se potriveste pentru spinning?", a: "Marime 2000-2500, recuperare rapida (minim 5.2:1), greutate sub 250g."},
    {q: "Ce fir sa folosesc?", a: "Monofilament - versatil si ieftin, bun pentru feeder. Textil (impletit) - zero elasticitate, ideal pentru spinning. Fluorocarbon - invizibil in apa, bun ca leader."},
    {q: "Ce naluci trebuie sa am pentru spinning?", a: "Un twister (silicon), un spinner, un vobleras plutitor si un jig. Marimile de 5-7cm acopera stiuca, salau si biban."},
    {q: "Merita un cort de pescuit?", a: "Daca pescuiesti noaptea sau in sezonul rece, absolut. Te protejeaza de soare si tantari chiar si vara."}
  ]
},

"sanatate-frumusete": {
  metaTitle: "Sanatate si frumusete - Cosmetice, aparate, vitamine | TopBuy.ro",
  metaDescription: "Peste 143.000 produse de sanatate si frumusete. Parfumuri, creme, aparate de ingrijire, vitamine si suplimente de la magazine verificate.",
  h1: "Sanatate si Frumusete",
  intro: `Peste 143.000 de produse - cea mai mare categorie de pe TopBuy.ro. Include parfumuri, cosmetice, creme, sampoane, aparate de ingrijire (epilatoare, aparate de tuns, periute electrice), aparatura medicala (tensiometre, pulsoxiometre), vitamine si suplimente.
Parfumurile si cosmeticele sunt cele mai cautate. Preturile la parfumuri variaza foarte mult intre magazine - acelasi parfum poate avea diferente de 50-100 lei, deci compararea se merita.
Ghidurile de mai jos acopera cele mai populare cautari, de la "cele mai bune creme antirid" la "periuta electrica pareri".`,
  tips: [
    "La parfumuri, concentratia conteaza: Eau de Parfum (EDP) tine 6-8 ore, Eau de Toilette (EDT) 3-4 ore. EDP e mai scump dar folosesti mai putin.",
    "La cremele de fata, ingredientele active conteaza mai mult decat brandul. Retinol pentru antiaging, niacinamida pentru pori, acid hialuronic pentru hidratare.",
    "La periutele electrice, diferenta reala o fac capetele de schimb - verifica pretul si disponibilitatea lor inainte de a alege periuta.",
    "La aparatele de tuns, numarul de trepte de lungime si calitatea lamelor conteaza mai mult decat puterea motorului.",
    "Vitaminele si suplimentele nu inlocuiesc o dieta echilibrata. Consulta un medic inainte de suplimente pe termen lung."
  ],
  faq: [
    {q: "Cum stiu daca un parfum e original?", a: "Cumpara de la magazine autorizate. Pe TopBuy.ro, toate magazinele sunt verificate prin 2Performant."},
    {q: "Ce periuta electrica sa aleg?", a: "Oral-B (oscilanta) si Philips Sonicare (sonica) sunt cele doua optiuni principale. Ambele curata eficient. Alege dupa buget si pretul capetelor de schimb."},
    {q: "Merita un epilator electric?", a: "Da, pe termen lung e mai economic decat ceara sau laserul de salon. Primele utilizari sunt mai dureroase, dar pielea se obisnuieste."},
    {q: "Ce tensiometru sa cumpar pentru acasa?", a: "Un tensiometru de brat (nu de incheietura) cu memorie si detectie de aritmie. Omron si Beurer sunt de referinta. De la 100-150 lei."},
    {q: "Ce vitamine merita luate zilnic?", a: "Vitamina D e cea mai comuna deficienta in Romania. Magneziul ajuta la somn si muschi. Omega 3 daca nu mananci peste. Restul depind de analizele tale de sange."}
  ]
},

"carti-birou": {
  metaTitle: "Carti si birou - Papetarie, carti, accesorii birou | TopBuy.ro",
  metaDescription: "Peste 140.000 produse. Carti, papetarie, accesorii de birou, scaune, birouri si consumabile de la magazine verificate din Romania.",
  h1: "Carti si Birou",
  intro: `Peste 140.000 de produse din zona de carti, papetarie si accesorii de birou. Include carti pentru toate varstele si genurile, rechizite scolare, consumabile de birou, dar si mobilier de birou - scaune, birouri, rafturi.
Cartile sunt cel mai mare segment, de la literatura si dezvoltare personala pana la carti pentru copii si manuale. Preturile la carti variaza surprinzator de mult intre librarii.
Mobilierul de birou (scaune, birouri) a devenit tot mai cautat cu munca de acasa. Am grupat si aceste produse in ghiduri dedicate.`,
  tips: [
    "La carti, compara pretul cu cel de pe site-ul editurii. Uneori librariile mici au preturi mai bune decat cele mari.",
    "La scaunele de birou, reglajele conteaza mai mult decat aspectul. Minim: inaltime, inclinare spatar, suport lombar.",
    "La birouri, inaltimea standard e 72-75cm. Daca esti mai inalt sau mai scurt, un birou reglabil e o investitie buna.",
    "Rechizitele scolare cumpara-le din timp, in iulie-august. In septembrie preturile cresc si stocurile scad.",
    "La consumabile de imprimanta, compatibilele sunt mai ieftine si pentru uz casnic sunt suficiente."
  ],
  faq: [
    {q: "Cum aleg un scaun de birou bun?", a: "Buget minim 500-700 lei. Cauta: suport lombar reglabil, sezut cu burete dens, roti silentioase si garantie minim 2 ani."},
    {q: "Merita un birou standing (reglabil)?", a: "Daca stai peste 6 ore pe zi la birou, da. Alternarea sezut/in picioare reduce durerile de spate. Modelele electrice sunt mai practice. De la 1500 lei."},
    {q: "Ce carti de dezvoltare personala merita citite?", a: "Atomic Habits (James Clear) pentru obiceiuri, Deep Work (Cal Newport) pentru productivitate, Thinking Fast and Slow (Kahneman) pentru luarea deciziilor."},
    {q: "Cat trebuie sa coste un rucsac scolar bun?", a: "100-200 lei pentru unul care dureaza un an scolar. Verifica spatele captusit, bretele late si material rezistent la apa."},
    {q: "Cartusele compatibile strica imprimanta?", a: "Nu in mod normal, dar calitatea variaza. Cele mai ieftine pot avea scurgeri. Alege branduri de compatibile cunoscute. Garantia imprimantei nu se pierde legal."}
  ]
},

"alimentare-bauturi": {
  metaTitle: "Alimentare si bauturi - Cafea, ceai, vinuri | TopBuy.ro",
  metaDescription: "Peste 6.000 produse alimentare si bauturi. Cafea, ceai, vinuri, bere, alimente speciale de la magazine verificate din Romania.",
  h1: "Alimentare si Bauturi",
  intro: `Peste 6.000 de produse alimentare si bauturi - cafea (boabe, macinata, capsule), ceaiuri, vinuri, bere artizanala, spirtoase si alimente speciale. O categorie mai mica dar cu produse pe care le cumperi regulat.
Cafeaua e cel mai cautat produs, urmata de vinuri. La cafea, diferenta de pret intre magazine poate fi semnificativa, mai ales la cantitati mari (1kg).
Ghidurile de mai jos te ajuta sa compari optiunile pe tipuri de produse.`,
  tips: [
    "La cafeaua boabe, data prajitului conteaza mai mult decat brandul. Cafeaua isi pierde aroma dupa 4-6 saptamani de la prajire.",
    "La vinuri, pretul nu e intotdeauna indicator de calitate. Romania are vinuri excelente in gama 30-60 lei.",
    "Capsulele compatibile Nespresso sunt mult mai ieftine decat cele originale. Exista optiuni foarte bune.",
    "La ceai, cel in frunze e aproape intotdeauna superior celui din pliculete, ca gust si ca pret per cana.",
    "Verifica termenul de valabilitate la produsele cu reducere mare. Uneori pretul mic inseamna termen apropiat."
  ],
  faq: [
    {q: "Ce cafea boabe sa aleg pentru espressor automat?", a: "Blend cu Robusta pentru crema groasa si gust puternic. 100% Arabica pentru gust fin. Prajire medie e cea mai versatila. Incepe cu pachete mici."},
    {q: "Cum pastrez cafeaua proaspata?", a: "Recipient ermetic, temperatura camerei, ferit de lumina. Nu in frigider - absoarbe mirosuri. Macin-o inainte de preparare."},
    {q: "Ce vin rosu romanesc merita incercat?", a: "Feteasca Neagra e soiul emblematic. Crame bune: Budureasca, Crama Oprisor, SERVE. Gama 40-80 lei ofera vinuri serioase."},
    {q: "Care e diferenta intre whisky si bourbon?", a: "Bourbon-ul e facut din minim 51% porumb, maturat in butoaie noi de stejar, produs in SUA. Scotch-ul e din orz maltuit, maturat minim 3 ani in Scotia."},
    {q: "Merita sa cumpar alimente online?", a: "Pentru neperisabile (cafea, ceai, conserve) da - preturi mai bune si varietate mare. Pentru proaspete, depinde de logistica magazinului."}
  ]
},

"animale": {
  metaTitle: "Animale de companie - Hrana, accesorii, jucarii | TopBuy.ro",
  metaDescription: "Peste 32.000 produse pentru animale. Hrana, cusci, paturi, jucarii si accesorii pentru caini, pisici si alte animale de companie.",
  h1: "Animale de Companie",
  intro: `Peste 32.000 de produse pentru animale de companie - hrana (uscata, umeda, diete speciale), accesorii, jucarii, cusci, paturi, zgarde, lese si tot ce mai ai nevoie.
Hrana e cel mai cautat produs si probabil cel mai important. Calitatea hranei afecteaza direct sanatatea animalului pe termen lung. Am grupat produsele pe tipuri si pe specii.
Preturile la hrana variaza mult intre magazine, mai ales la sacii mari (10-15kg). La achizitii recurente, economiile se aduna.`,
  tips: [
    "La hrana uscata, primele 3 ingrediente de pe eticheta conteaza cel mai mult. Cauta carne pe primul loc, nu cereale.",
    "Pisicile beau putin apa, deci hrana umeda ajuta la hidratare. Combina hrana uscata cu cea umeda.",
    "La paturi, alege o dimensiune cu 10-15cm mai mare decat animalul intins.",
    "Jucariile interactive (puzzle feeders) ajuta la stimularea mentala. Un caine plictisit roade mobila.",
    "Verifica greutatea recomandata pe ambalaj. Hrana pentru caini mici nu e potrivita pentru rase mari."
  ],
  faq: [
    {q: "Ce hrana uscata e buna pentru caine?", a: "Depinde de varsta, marime si sanatate. Branduri bune: Royal Canin, Acana, Orijen, Taste of the Wild. Carne pe primul loc pe eticheta, fara coloranti artificiali."},
    {q: "Cat de des trebuie hranit un caine adult?", a: "De doua ori pe zi. Cantitatea depinde de greutate si activitate - urmeaza indicatiile de pe ambalaj."},
    {q: "Ce nisip de pisici sa aleg?", a: "Aglomerant (bentonita) e cel mai popular - formeaza bulgari, usor de curatat. Silicat absoarbe mirosuri mai bine dar nu aglomereaza. Evita parfumul intens."},
    {q: "Merita o cusca pentru caine?", a: "Da, folosita ca loc de refugiu (nu pedeapsa). Cainii apreciaza un spatiu al lor. Marimea: sa se poata intoarce, ridica si intinde complet."},
    {q: "Cat costa intretinerea lunara a unui caine?", a: "Hrana 150-400 lei (depinde de marime), deparazitare 30-50 lei, accesorii 50 lei, veterinar preventiv 50-100 lei. Total: 300-600 lei/luna."}
  ]
},

"altele": {
  metaTitle: "Alte produse - Diverse categorii | TopBuy.ro",
  metaDescription: "Peste 18.000 produse din diverse categorii, de la magazine verificate din Romania.",
  h1: "Alte Produse",
  intro: `Aici gasesti peste 18.000 de produse care nu se incadreaza perfect in celelalte categorii. Include articole diverse, de la decoratiuni si cadouri pana la produse de nisa.
E o categorie variata, asa ca foloseste subcategoriile si ghidurile de mai jos pentru a naviga mai usor.`,
  tips: [
    "Compara preturile intre magazine, mai ales la produsele de nisa unde diferentele pot fi mari.",
    "Verifica politica de retur inainte de a comanda produse din categorii mai putin standard.",
    "La produsele cu variante (culoare, marime), verifica pe site-ul magazinului ca varianta dorita e pe stoc."
  ],
  faq: [
    {q: "De ce apare un produs in Alte Produse?", a: "Unele magazine categorizeaza produsele diferit. Produsul e la fel de valid, doar nu a putut fi incadrat automat intr-o categorie specifica."},
    {q: "Pot gasi acelasi produs si in alta categorie?", a: "Da, e posibil daca magazinele il clasifica diferit. Pretul si linkul catre magazin raman aceleasi."}
  ]
}

};

for (const [key, val] of Object.entries(pillars)) {
  d[key] = val;
}

writeFileSync(CONTENT_PATH, JSON.stringify(d, null, 2));

console.log('Updated 12 pillar pages:');
for (const [key, val] of Object.entries(pillars)) {
  const words = val.intro.split(/\s+/).length;
  console.log(`  ${key}: ~${words} words intro, ${val.faq.length} FAQ, ${val.tips.length} tips`);
}
