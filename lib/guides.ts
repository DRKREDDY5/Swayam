export type Language = 'te' | 'en';
export type Copy = { te: string; en: string };
export type Guide = { id: string; category: string; title: Copy; summary: Copy; steps: Copy[]; note: Copy; sourceIds: string[]; actionId: string; reviewed: string; kind: 'procedure' | 'entrypoint' | 'recipe'; keywords: string[] };
export const SOURCES: Record<string,{title:string;url:string;publisher:string;published?:string;checked:string;scope:string}> = {
 lpg:{title:'LPG biometric authentication channels',url:'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2031879',publisher:'Ministry of Petroleum and Natural Gas · PIB',published:'2024-07-09',checked:'2026-09-18',scope:'Provider apps, distributor showrooms, and delivery personnel are listed as authentication channels. This older release does not establish current deadlines or subsidy status.'},
 indane:{title:'IndianOil LPG services',url:'https://iocl.com/lpg-services',publisher:'IndianOil',checked:'2026-09-18',scope:'Official customer portal, distributor locator and customer support entry points.'},
 aadhaar:{title:'UIDAI official services',url:'https://uidai.gov.in/en/',publisher:'UIDAI',checked:'2026-09-18',scope:'Official service entry point. Swayam does not reproduce unverified current app screens, fees, or appointment availability.'},
 digi:{title:'DigiLocker official portal',url:'https://www.digilocker.gov.in/',publisher:'DigiLocker · MeitY',checked:'2026-09-18',scope:'Official entry point only. Detailed current workflow could not be read during this review.'},
 pension:{title:'Jeevan Pramaan service and FAQs',url:'https://jeevanpramaan.gov.in/v2.0/misc/faq',publisher:'Jeevan Pramaan · Government of India',checked:'2026-09-18',scope:'Digital life certificate service and assisted access for eligible pensioners. Confirm scheme eligibility and due date with the pension disbursing agency.'},
 lemon:{title:'Lemon rice recipe',url:'https://www.vegrecipesofindia.com/lemon-rice/',publisher:'Dassana Amit · Veg Recipes of India',published:'2023-02-28',checked:'2026-09-18',scope:'Brief paraphrase of the published method; follow the original recipe for exact quantities.'},
};
export const ACTIONS: Record<string,{title:Copy;url:string}> = {
 indane:{title:{en:'Open IndianOil services',te:'IndianOil సేవలు తెరవండి'},url:'https://iocl.com/lpg-services'},
 lpg:{title:{en:'See official LPG options',te:'అధికారిక LPG మార్గాలు చూడండి'},url:SOURCES.lpg.url},
 aadhaar:{title:{en:'Open UIDAI',te:'UIDAI తెరవండి'},url:SOURCES.aadhaar.url},
 digi:{title:{en:'Open DigiLocker',te:'DigiLocker తెరవండి'},url:SOURCES.digi.url},
 pension:{title:{en:'Open Jeevan Pramaan',te:'Jeevan Pramaan తెరవండి'},url:SOURCES.pension.url},
 lemon:{title:{en:'See the full recipe',te:'పూర్తి వంటకం చూడండి'},url:SOURCES.lemon.url}
};
export const GUIDES: Guide[] = [
 {id:'lpg',category:'services',title:{te:'గ్యాస్ ఆధార్ KYC',en:'LPG Aadhaar KYC'},summary:{te:'మీ గ్యాస్ సంస్థ ద్వారా KYC చేసే మార్గాలు తెలుసుకుందాం.',en:'Find the official route for your LPG provider.'},steps:[
 {te:'మీ బిల్లు మీద గ్యాస్ సంస్థ పేరు చూడండి: Indane, Bharatgas లేదా HP Gas. ఆధార్ నంబర్ ఇక్కడ చెప్పవద్దు.',en:'Check your bill for the provider: Indane, Bharatgas or HP Gas. Keep your Aadhaar number private.'},
 {te:'కింద ఉన్న అధికారిక సమాచారంలో మీ సంస్థ యాప్ లింక్ ఎంచుకోండి. యాప్‌లో అందుబాటులో ఉన్న KYC సూచనలు అనుసరించండి.',en:'Use your provider’s app link in the official information below. Follow the KYC instructions available in that app.'},
 {te:'యాప్ ఉపయోగించడం కష్టంగా ఉంటే మీ గ్యాస్ డిస్ట్రిబ్యూటర్‌ను సంప్రదించండి. డెలివరీ సిబ్బంది ద్వారా సహాయం అందుతుందో అడగవచ్చు.',en:'If the app is difficult, contact your distributor. You can also ask delivery personnel about assisted authentication.'},
 {te:'KYC పూర్తయిందో మీ సంస్థలోనే నిర్ధారించుకోండి. స్వయం మీ స్థితిని తనిఖీ చేయదు లేదా KYC పూర్తి చేయదు.',en:'Confirm completion with your provider. Swayam cannot check your status or complete your KYC.'}
 ],note:{te:'ఆధారం: జూలై 2024 అధికారిక ప్రకటన. ప్రస్తుత గడువు, యాప్ స్క్రీన్లు లేదా సబ్సిడీ స్థితిని ఇక్కడ నిర్ధారించలేను.',en:'Based on a July 2024 official release. Current deadlines, app screens and subsidy status are not verified here.'},sourceIds:['lpg','indane'],actionId:'lpg',reviewed:'2026-09-18',kind:'procedure',keywords:['gas','గ్యాస్','గ్యాసు','గ్యాస్కి','indane','ఇండేన్','ఇండియన్ గ్యాస్','lpg','bharatgas','hp gas','cylinder','సిలిండర్']},
 {id:'aadhaar',category:'services',title:{te:'ఆధార్ సేవలు',en:'Aadhaar services'},summary:{te:'మార్పులు, కేంద్రాలు, సహాయం కోసం UIDAI అధికారిక సేవలకు వెళ్దాం.',en:'Find the official starting point for updates, centres and support.'},steps:[
 {te:'ఆధార్‌లో ఏ సమాచారం మార్చాలో నిర్ణయించుకోండి. వ్యక్తిగత వివరాలను ఈ చాట్‌లో పంపవద్దు.',en:'Identify what you want to update. Do not send personal identity details into this chat.'},
 {te:'కింద UIDAI లింక్ తెరవండి. మీకు కావలసిన సేవకు ప్రస్తుత అధికారిక సూచనలు చూడండి.',en:'Open UIDAI below and check the current official instructions for your chosen service.'},
 {te:'ఆన్‌లైన్ మార్గం సరిపోకపోతే, UIDAI ద్వారా అధికారిక కేంద్రం లేదా సహాయ మార్గం వెతకండి.',en:'If the online route does not meet your needs, use UIDAI to find an official centre or support route.'}
 ],note:{te:'ఇది అధికారిక సేవకు ప్రారంభ మార్గం మాత్రమే. ప్రస్తుత ఫీజు, అవసరమైన పత్రాలు లేదా మొబైల్ నంబర్ మార్పు స్క్రీన్లను నిర్ధారించలేదు.',en:'Official entry point only. Current fees, document requirements and mobile-update screens have not been verified.'},sourceIds:['aadhaar'],actionId:'aadhaar',reviewed:'2026-09-18',kind:'entrypoint',keywords:['aadhaar','aadhar','ఆధార్','ఆధార','uidai','ఆధారు']},
 {id:'digilocker',category:'documents',title:{te:'డిజిటల్ పత్రాలు',en:'Digital documents'},summary:{te:'DigiLocker అధికారిక సేవను ఎలా చేరుకోవాలో తెలుసుకుందాం.',en:'Find the official DigiLocker service.'},steps:[
 {te:'కింద ఉన్న DigiLocker అధికారిక లింక్ తెరవండి. పత్రాలు ఈ యాప్‌కు అప్‌లోడ్ చేయవద్దు.',en:'Open the official DigiLocker link below. Do not upload identity documents to Swayam.'},
 {te:'లాగిన్, OTP మరియు పత్రాలకు సంబంధించిన సూచనలను DigiLockerలోనే అనుసరించండి.',en:'Follow sign-in, OTP and document instructions inside DigiLocker itself.'},
 {te:'పత్రం కనిపించకపోతే DigiLocker సహాయం లేదా పత్రం ఇచ్చిన సంస్థను సంప్రదించండి.',en:'If your document is unavailable, contact DigiLocker support or the issuing organization.'}
 ],note:{te:'ప్రస్తుత పత్రాల స్క్రీన్లను నేను నిర్ధారించలేకపోయాను. మీ పత్రాలు అందుబాటులో ఉన్నాయని హామీ ఇవ్వలేను.',en:'Current document screens could not be verified. I cannot guarantee that your document is available.'},sourceIds:['digi'],actionId:'digi',reviewed:'2026-09-18',kind:'entrypoint',keywords:['digilocker','డిజిలాకర్','డిజిటల్','document','పత్రం','పత్రాలు','certificate','సర్టిఫికేట్']},
 {id:'pension',category:'services',title:{te:'పెన్షన్ జీవన ధృవపత్రం',en:'Pension life certificate'},summary:{te:'Jeevan Pramaan గురించి మరియు సహాయం పొందే మార్గం గురించి తెలుసుకుందాం.',en:'Understand Jeevan Pramaan and where to get help.'},steps:[
 {te:'మీ పెన్షన్ ఇచ్చే సంస్థ Jeevan Pramaan అంగీకరిస్తుందో, గడువు ఏదో ఆ సంస్థతో నిర్ధారించండి.',en:'Confirm with your pension disbursing agency that it accepts Jeevan Pramaan and ask about your due date.'},
 {te:'అధికారిక సైట్‌లో మీకు అనువైన యాప్ లేదా సమీప Jeevan Pramaan కేంద్రం గురించి చూడండి.',en:'Use the official site to find a suitable application or a nearby Jeevan Pramaan centre.'},
 {te:'అవసరమైన వివరాలు, బయోమెట్రిక్ నిర్ధారణను అధికారిక సేవలోనే పూర్తి చేయండి. వ్యక్తిగత నంబర్లు ఇక్కడ చెప్పవద్దు.',en:'Complete required details and biometric authentication only through the official service. Do not share private numbers here.'},
 {te:'ధృవపత్రం రూపొందితే వచ్చిన నిర్ధారణను భద్రంగా ఉంచండి. స్వయం మీ ధృవపత్రాన్ని సమర్పించదు.',en:'Keep the acknowledgement after successful certificate generation. Swayam does not submit your certificate.'}
 ],note:{te:'అర్హత, గడువు మీ పెన్షన్ సంస్థపై ఆధారపడతాయి. వ్యక్తిగత స్థితిని ఇక్కడ తనిఖీ చేయలేను.',en:'Eligibility and deadlines depend on your pension agency. Personal status cannot be checked here.'},sourceIds:['pension'],actionId:'pension',reviewed:'2026-09-18',kind:'procedure',keywords:['pension','పెన్షన్','జీవన్','jeevan','life certificate','జీవన ధృవ']},
 {id:'lemon-rice',category:'kitchen',title:{te:'నిమ్మకాయ అన్నం',en:'Lemon rice'},summary:{te:'సాధారణ విధానం తెలుసుకుందాం. కొలతల కోసం పూర్తి వంటకం చూడండి.',en:'A brief recipe walkthrough. Open the source for exact quantities.'},steps:[
 {te:'వండిన అన్నం, నిమ్మరసం, నూనె, ఆవాలు, మినప్పప్పు, కరివేపాకు, మిరపకాయలు, పసుపు సిద్ధం చేయండి.',en:'Prepare cooked rice, lemon juice, oil, mustard seeds, urad dal, curry leaves, chillies and turmeric.'},
 {te:'వేరుశెనగలు లేదా జీడిపప్పు వాడితే అలెర్జీ ఉందో ముందుగా చూసుకోండి. అలెర్జీకి అనుకూలమని ఈ వంటకాన్ని హామీ ఇవ్వను.',en:'The source includes peanuts and cashews. Check allergies first; this guide cannot certify the recipe as allergy-safe.'},
 {te:'నూనెలో తాలింపు దినుసులు వేయించి, మంట ఆపిన తరువాత పసుపు కలపండి.',en:'Cook the tempering ingredients in oil; add turmeric after switching off the heat.'},
 {te:'తాలింపును అన్నంలో వేసి నిమ్మరసం, తగిన ఉప్పు కలపండి. పూర్తి విధానం కింద లింక్‌లో ఉంది.',en:'Mix the tempering into the rice, then add lemon juice and salt to taste. See the full source below.'}
 ],note:{te:'ప్రచురిత వంటకం సంక్షిప్త వివరణ. స్వయం వంటకం మూలాన్ని చూపుతుంది; వైద్య లేదా అలెర్జీ భద్రతా నిర్ధారణ ఇవ్వదు.',en:'Brief paraphrase of a published recipe, not medical or allergy-safety certification.'},sourceIds:['lemon'],actionId:'lemon',reviewed:'2026-09-18',kind:'recipe',keywords:['lemon rice','నిమ్మకాయ అన్నం','నిమ్మ అన్నం','nimmakaya annam','nimmakaya pulihora']}
];
export function getGuide(id:string){return GUIDES.find(g=>g.id===id);}
export function sourceLink(id:string){return SOURCES[id];}
