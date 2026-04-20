import 'dotenv/config';
import { PrismaClient, UseCaseSector } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const CATEGORY_TO_SECTOR: Record<string, UseCaseSector> = {
  'Bouw & Aannemerij': 'BOUW',
  'Installatie & Techniek': 'INSTALLATIE',
  'Onderhoud & Servicebedrijven': 'ONDERHOUD',
  'Productie & Maakindustrie': 'PRODUCTIE',
  'Logistiek & Transport': 'LOGISTIEK',
  'Zorginstellingen kleinschalig': 'ZORG',
  'Bouwgerelateerde diensten': 'BOUW_DIENSTEN',
  'Zakelijke Dienstverlening': 'ZAKELIJK',
  'Accountancy- & Administratiekantoren': 'ACCOUNTANCY',
  'Energie, Installateurs & Duurzaamheidsadvies': 'ENERGIE',
};

const USE_CASES = [
  {
    title: 'AI-offertescan voor aannemers',
    summary:
      'Een tool die aangeleverde bestekken, tekeningen en klantmails automatisch uitleest en omzet naar een eerste kostenraming en takenlijst, zodat kleine bouwbedrijven sneller kunnen offreren terwijl ze weinig tijd en digitale kennis hebben.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '50% minder tijd nodig voor het opstellen van een eerste offerte',
      '20% minder fouten in hoeveelheden en posten',
    ],
    tags: ['ai', 'document-processing', 'nlp', 'automation', 'construction'],
    isShipped: false,
  },
  {
    title: 'Digitale werkbon app voor bouwteams',
    summary:
      "Een eenvoudige mobiele app waarmee uitvoerders en timmermannen uren, materialen en foto's per klus registreren, automatisch gekoppeld aan planning en facturatie.",
    category: 'Bouw & Aannemerij',
    outcomes: [
      '80% minder papieren werkbonnen',
      '30% sneller factureren na oplevering',
    ],
    tags: [
      'mobile-app',
      'workflow',
      'integration',
      'construction',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'Slimme planning voor bouwprojecten',
    summary:
      'Een planningsbord dat mensen, onderaannemers en leveringen plant via drag-and-drop, met automatische signalen bij overbezetting of overlap.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '25% minder planafwijkingen per project',
      '15% minder urenverlies door dubbele boekingen',
    ],
    tags: [
      'planning',
      'optimization',
      'dashboard',
      'construction',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'AI-assistent voor aanbestedingsstukken',
    summary:
      'Een LLM-assistent die aanbestedingsdocumenten samenvat, eisen markeert en standaardantwoorden voor EMVI-vragen voorstelt voor mkb-aannemers.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '40% minder tijd nodig voor het doornemen van aanbestedingen',
      '15% hogere scoringskans door completere beantwoording',
    ],
    tags: ['ai', 'llm', 'document-processing', 'nlp', 'construction'],
    isShipped: false,
  },
  {
    title: 'Projectvoortgangsdashboard voor kleine bouwprojecten',
    summary:
      'Een eenvoudig dashboard dat per project budget, uren, meerwerk en planning toont, gevoed vanuit werkbonnen en boekhouding.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '30% sneller inzicht in winstgevendheid per project',
      '20% minder verrassingen bij nacalculatie',
    ],
    tags: [
      'dashboard',
      'analytics',
      'construction',
      'integration',
      'reporting',
    ],
    isShipped: false,
  },
  {
    title: 'Faalkosten-analyse met AI',
    summary:
      'Een oplossing die opleverpunten, meerwerk en storingsmeldingen analyseert om patronen in faalkosten te herkennen en verbetervoorstellen te doen.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '15% daling van faalkosten binnen 12 maanden',
      '20% minder herhaalproblemen op terugkerende details',
    ],
    tags: ['ai', 'analytics', 'quality', 'construction', 'data-platform'],
    isShipped: false,
  },
  {
    title: 'Klantportaal voor verbouw- en renovatieprojecten',
    summary:
      'Een portaal waarin particuliere klanten planning, foto-updates, meerwerkvoorstellen en documenten zien en digitaal kunnen goedkeuren.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '50% minder telefoontjes en mails over projectstatus',
      '30% snellere goedkeuring van meerwerk',
    ],
    tags: [
      'portal',
      'customer-experience',
      'construction',
      'e-signature',
      'workflow',
    ],
    isShipped: false,
  },
  {
    title: 'Materieel- en gereedschap planning',
    summary:
      'Een eenvoudig reserveringssysteem voor steigers, busjes en gereedschap zodat teams niet op de bouwplaats zonder materiaal staan.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '25% minder stilstand door ontbrekend materieel',
      '10% langere levensduur door beter gebruik en onderhoud',
    ],
    tags: ['planning', 'inventory', 'construction', 'workflow', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Digitale veiligheidsinspecties op de bouwplaats',
    summary:
      "Een inspectie-app waarmee voormannen via checklists en foto's veiligheidsrondes vastleggen, met automatische rapportage en opvolgtaken.",
    category: 'Bouw & Aannemerij',
    outcomes: [
      '60% minder tijd voor het maken van VGM-rapporten',
      '20% minder geregistreerde veiligheidsincidenten',
    ],
    tags: ['mobile-app', 'compliance', 'construction', 'workflow', 'reporting'],
    isShipped: false,
  },
  {
    title: 'Spraak-naar-tekst dagrapporten',
    summary:
      'Een oplossing waarmee uitvoerders via spraak hun dagrapport inspreken, dat automatisch wordt omgezet naar gestructureerde tekst in het projectdossier.',
    category: 'Bouw & Aannemerij',
    outcomes: [
      '50% minder tijd aan dagrapportage',
      '90% meer volledigheid van dagelijks vastgelegde informatie',
    ],
    tags: ['ai', 'speech-to-text', 'nlp', 'mobile-app', 'construction'],
    isShipped: false,
  },
  {
    title: 'Monteursplanning en route-optimalisatie',
    summary:
      'Een planningsmodule die monteurs automatisch inplant op klussen op basis van locatie, specialisme en reistijd.',
    category: 'Installatie & Techniek',
    outcomes: [
      '20% minder reistijd per monteur per dag',
      '15% meer uitgevoerde opdrachten per week',
    ],
    tags: [
      'optimization',
      'routing',
      'field-service',
      'dashboard',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'AI-storingsdiagnose voor installaties',
    summary:
      'Een kennis- en AI-assistent waarin monteurs storingen beschrijven en direct voorgestelde oorzaken en oplossingen krijgen op basis van eerdere cases.',
    category: 'Installatie & Techniek',
    outcomes: [
      '25% kortere gemiddelde storingsduur',
      '30% minder second visits voor hetzelfde probleem',
    ],
    tags: ['ai', 'knowledge-base', 'nlp', 'field-service', 'recommendation'],
    isShipped: false,
  },
  {
    title: 'Digitale werkbonnen gekoppeld aan CRM en facturatie',
    summary:
      "Een werkbon-oplossing waarmee monteurs uren, materialen en foto's vastleggen die automatisch naar het CRM en de factuur worden gestuurd.",
    category: 'Installatie & Techniek',
    outcomes: [
      '40% minder tijd tussen uitvoering en facturatie',
      '20% minder fouten in gefactureerde materialen',
    ],
    tags: [
      'mobile-app',
      'integration',
      'workflow',
      'field-service',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Contract- en onderhoudsbeheer',
    summary:
      "Een systeem dat onderhoudscontracten en SLA's bijhoudt, automatisch servicebeurten plant en herinneringen stuurt naar klant en planner.",
    category: 'Installatie & Techniek',
    outcomes: [
      '30% hogere contractverlenging door proactieve service',
      '50% minder gemiste onderhoudsbeurten',
    ],
    tags: ['crm', 'workflow', 'automation', 'field-service', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Remote video-inspectie met AI-assistent',
    summary:
      'Een tool waarmee monteurs videobeelden van installaties delen en laten analyseren door een AI die componenten herkent en mogelijke fouten aanwijst.',
    category: 'Installatie & Techniek',
    outcomes: [
      '20% minder onnodige voorrij-kosten',
      '15% snellere diagnose bij complexe storingen',
    ],
    tags: ['ai', 'computer-vision', 'video', 'field-service', 'remote-support'],
    isShipped: false,
  },
  {
    title: 'Busmagazijn voorraadbeheer',
    summary:
      'Een simpele voorraadmodule voor busmagazijnen die op basis van verbruik en min-max niveaus automatisch bestelvoorstellen maakt.',
    category: 'Installatie & Techniek',
    outcomes: [
      '30% minder misgrijpen op veelgebruikte onderdelen',
      '10% lagere voorraadwaarde in busmagazijnen',
    ],
    tags: ['inventory', 'workflow', 'automation', 'field-service', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Offertegenerator voor installatieprojecten',
    summary:
      "Een configurator die op basis van ruimte, verbruik en wensen snel gestandaardiseerde offertes maakt voor bijvoorbeeld warmtepompen of airco's.",
    category: 'Installatie & Techniek',
    outcomes: [
      '50% minder tijd per offerte',
      '15% hogere slagingskans door uniforme, professionele voorstellen',
    ],
    tags: ['configurator', 'sales', 'automation', 'field-service', 'cpq'],
    isShipped: false,
  },
  {
    title: 'Monitoringkoppeling met IoT-installaties',
    summary:
      'Een platform dat data uit slimme meters, omvormers of regelkasten verzamelt en eenvoudige dashboards maakt met alarmen bij afwijkingen.',
    category: 'Installatie & Techniek',
    outcomes: [
      '25% sneller reageren op kritieke storingen',
      '10% extra service-omzet door proactieve monitoring',
    ],
    tags: ['iot', 'dashboard', 'alerting', 'field-service', 'ai'],
    isShipped: false,
  },
  {
    title: 'Klantportaal voor service en planning',
    summary:
      'Een portaal waarin klanten storingen melden, afspraken plannen en statusupdates zien van lopende werkzaamheden.',
    category: 'Installatie & Techniek',
    outcomes: [
      '40% minder telefoontjes naar de planning',
      '20% hogere klanttevredenheidsscore',
    ],
    tags: [
      'portal',
      'customer-experience',
      'workflow',
      'integration',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'AI-gestuurde prioritering van onderhoudsverzoeken',
    summary:
      'Een AI-model dat serviceverzoeken beoordeelt op urgentie en impact en ze automatisch prioriteert in de planning.',
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '30% sneller oplossen van kritieke storingen',
      '15% minder SLA-overtredingen',
    ],
    tags: ['ai', 'nlp', 'routing', 'workflow', 'field-service'],
    isShipped: false,
  },
  {
    title: 'Storingsmelding en ticket intake portal',
    summary:
      "Een eenvoudige web- en mobiele portal waar klanten storingen melden met foto's en video's, direct vertaald naar tickets met alle relevante info.",
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '50% minder onvolledige storingsmeldingen',
      '20% kortere doorlooptijd van melding tot ingepland bezoek',
    ],
    tags: [
      'portal',
      'mobile-app',
      'field-service',
      'workflow',
      'customer-experience',
    ],
    isShipped: false,
  },
  {
    title: 'Digitale inspectierapporten met fotobewijs',
    summary:
      "Een app voor inspecteurs om checklists af te werken en foto's toe te voegen, met automatische PDF-rapportage in eigen huisstijl.",
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '60% minder tijd voor uitwerken van rapporten',
      '90% minder discussies over uitgevoerde werkzaamheden',
    ],
    tags: [
      'mobile-app',
      'reporting',
      'workflow',
      'field-service',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Route-optimalisatie voor onderhoudsploegen',
    summary:
      'Een tool die dagelijkse routes van onderhoudsploegen optimaliseert op reistijd en tijdvakken bij klanten.',
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '20% minder kilometers per dag',
      '15% meer bezoeken per monteur per dag',
    ],
    tags: [
      'routing',
      'optimization',
      'dashboard',
      'field-service',
      'logistics',
    ],
    isShipped: false,
  },
  {
    title: 'SLA-dashboard met realtime alerts',
    summary:
      "Een dashboard dat SLA's, responstijden en open tickets toont, met automatische waarschuwingen bij risico op overschrijding.",
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      "25% minder gemiste SLA's",
      '20% minder escalaties naar het management',
    ],
    tags: [
      'dashboard',
      'alerting',
      'analytics',
      'field-service',
      'service-management',
    ],
    isShipped: false,
  },
  {
    title: 'Contractbeheer en verlengingssignalen',
    summary:
      'Een systeem dat onderhoudscontracten, looptijden en tarieven bijhoudt en tijdig signaleert welke contracten verlengd of heronderhandeld moeten worden.',
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '30% hogere contractverlengingsratio',
      '50% minder contracten die ongemerkt aflopen',
    ],
    tags: ['crm', 'workflow', 'automation', 'field-service', 'billing'],
    isShipped: false,
  },
  {
    title: 'Eenvoudige predictive maintenance op basis van historie',
    summary:
      "Een AI-model dat storings- en onderhoudshistorie analyseert om voor specifieke klantinstallaties een voorspelling te doen van storingsrisico's.",
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '15% minder onverwachte storingen',
      '10% hogere bezettingsgraad van monteurs op gepland onderhoud',
    ],
    tags: [
      'ai',
      'predictive-modeling',
      'analytics',
      'field-service',
      'maintenance',
    ],
    isShipped: false,
  },
  {
    title: 'Klantfeedback en NPS-tool na bezoek',
    summary:
      'Een simpele tool die na elk onderhoudsbezoek automatisch een korte klanttevredenheidsenquête verstuurt en de resultaten in één dashboard toont.',
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '30% hogere respons op klanttevredenheidsonderzoeken',
      '15% verbetering van NPS binnen een jaar',
    ],
    tags: [
      'customer-experience',
      'survey',
      'dashboard',
      'automation',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'Selfservice afsprakenplanner voor onderhoud',
    summary:
      'Een online planner waarin klanten zelf een geschikt tijdvak kiezen binnen de beschikbare capaciteit, gekoppeld aan het planningssysteem.',
    category: 'Onderhoud & Servicebedrijven',
    outcomes: [
      '40% minder telefoontjes over afspraakplanning',
      '10% minder no-shows bij servicebezoeken',
    ],
    tags: [
      'portal',
      'customer-experience',
      'planning',
      'integration',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'OEE-monitor voor kleine productiebedrijven',
    summary:
      'Een light-weight oplossing die via sensoren of handmatige input stilstand, snelheid en kwaliteit meet en OEE per lijn toont.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '10% verbetering van OEE binnen 6 maanden',
      '50% minder tijd aan het handmatig maken van Excel-overzichten',
    ],
    tags: ['dashboard', 'manufacturing', 'analytics', 'iot', 'reporting'],
    isShipped: false,
  },
  {
    title: 'Visuele kwaliteitscontrole met AI-camera',
    summary:
      'Een camerasysteem dat met AI productafwijkingen detecteert en operators direct waarschuwt bij kwaliteitsproblemen.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '30% minder afgekeurde eindproducten',
      '40% minder manuren voor handmatige visuele controle',
    ],
    tags: ['ai', 'computer-vision', 'quality', 'manufacturing', 'automation'],
    isShipped: false,
  },
  {
    title: 'Productieplanning en ordersequencing',
    summary:
      'Een planningstool die orders, omsteltijden en levertijden combineert om een optimale productiesequentie voor te stellen.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '15% kortere gemiddelde doorlooptijd per order',
      '10% minder omstelverliezen',
    ],
    tags: [
      'optimization',
      'manufacturing',
      'dashboard',
      'planning',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Digitale werkorders op tablets',
    summary:
      'Een werkordersysteem waarbij operators per order digitale instructies, tekeningen en checklists op een tablet zien en afvinken.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '70% minder papieren werkorders op de vloer',
      '20% minder fouten door verouderde instructies',
    ],
    tags: [
      'mobile-app',
      'manufacturing',
      'workflow',
      'integration',
      'documentation',
    ],
    isShipped: false,
  },
  {
    title: 'Vraagvoorspelling per productfamilie',
    summary:
      'Een AI-forecastingmodel dat historische orders en seizoenseffecten gebruikt om de vraag per productfamilie te voorspellen.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '20% lagere veiligheidsvoorraad zonder servicegraadverlies',
      '15% minder spoedorders in de productie',
    ],
    tags: ['ai', 'forecasting', 'analytics', 'manufacturing', 'supply-chain'],
    isShipped: false,
  },
  {
    title: 'Stilstand-reden logging met AI-samenvatting',
    summary:
      'Een tool waarin operators stilstandredenen ingeven of inspreken, waarna AI de oorzaken clustert en managementrapportages maakt.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '50% sneller inzicht in top 5 stilstandoorzaken',
      '10% reductie in stilstand door gerichte acties',
    ],
    tags: ['ai', 'nlp', 'analytics', 'manufacturing', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Energieverbruiksdashboard voor machines',
    summary:
      'Een dashboard dat energieverbruik per lijn of machine toont en vergelijkt met productie-output.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '10% lager energieverbruik per geproduceerde eenheid',
      '20% sneller detecteren van afwijkend verbruik',
    ],
    tags: ['dashboard', 'energy', 'manufacturing', 'analytics', 'iot'],
    isShipped: false,
  },
  {
    title: 'Offerte- en calculatietool voor maakdelen',
    summary:
      'Een calculatietool die op basis van materiaal, bewerkingstijd en machine-uren snel kostprijzen en verkoopprijzen berekent.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '40% minder tijd per offerte',
      '15% hogere marge door consistente calculatie',
    ],
    tags: ['cpq', 'sales', 'manufacturing', 'automation', 'pricing'],
    isShipped: false,
  },
  {
    title: 'Traceability en batchregistratie',
    summary:
      'Een eenvoudige oplossing om batches grondstoffen en eindproducten te registreren en te volgen, gekoppeld aan labels en scanners.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '90% sneller kunnen terugzoeken bij klachten',
      '100% traceerbaarheid voor audits',
    ],
    tags: [
      'traceability',
      'manufacturing',
      'inventory',
      'compliance',
      'mobile-app',
    ],
    isShipped: false,
  },
  {
    title: 'Lichtgewicht MRP voor mkb-fabrieken',
    summary:
      'Een vereenvoudigde MRP-module die bestellingen en productievoorstellen genereert op basis van stuklijsten, voorraad en vraag.',
    category: 'Productie & Maakindustrie',
    outcomes: [
      '20% minder materiaaltekorten',
      '10% lagere totale voorraadwaarde',
    ],
    tags: [
      'planning',
      'supply-chain',
      'manufacturing',
      'dashboard',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Ritplanning en route-optimalisatie voor transport',
    summary:
      'Een planningsoplossing die orders, venstertijden en voertuigen combineert om optimale routes te berekenen voor kleine vervoerders.',
    category: 'Logistiek & Transport',
    outcomes: [
      '15% minder kilometers per dag',
      '10% lagere brandstofkosten per maand',
    ],
    tags: ['routing', 'optimization', 'logistics', 'dashboard', 'automation'],
    isShipped: false,
  },
  {
    title: 'Chauffeursapp met ritinformatie en POD',
    summary:
      "Een mobiele app voor chauffeurs met ritlijst, navigatie, digitale handtekening en foto's als proof of delivery.",
    category: 'Logistiek & Transport',
    outcomes: [
      '80% minder papieren vrachtbrieven voor eigen administratie',
      '30% snellere verwerking van afleverbewijzen',
    ],
    tags: [
      'mobile-app',
      'logistics',
      'workflow',
      'integration',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'Klant-ETA portal en notificaties',
    summary:
      'Een portal en notificatiesysteem dat klanten automatisch op de hoogte houdt van verwachte aankomsttijd en vertragingen.',
    category: 'Logistiek & Transport',
    outcomes: [
      '40% minder telefoontjes over zendingstatus',
      '15% hogere klanttevredenheid',
    ],
    tags: [
      'portal',
      'customer-experience',
      'logistics',
      'integration',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'AI-analyse van rijgedrag en verbruik',
    summary:
      'Een AI-tool die tachograaf- en verbruiksdata analyseert en chauffeurs persoonlijke tips geeft voor veiliger en zuiniger rijden.',
    category: 'Logistiek & Transport',
    outcomes: [
      '8% lager brandstofverbruik per kilometer',
      '20% minder zware remacties per chauffeur',
    ],
    tags: ['ai', 'analytics', 'telematics', 'logistics', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Cross-dock laadplanning',
    summary:
      'Een planningsmodule die docks, binnenkomende en vertrekkende ritten afstemt en tijdsloten optimaliseert.',
    category: 'Logistiek & Transport',
    outcomes: [
      '25% minder wachttijd voor chauffeurs bij het dock',
      '15% hogere doorzet per uur',
    ],
    tags: ['planning', 'logistics', 'dashboard', 'optimization', 'warehouse'],
    isShipped: false,
  },
  {
    title: 'Lightweight TMS voor mkb-vervoerders',
    summary:
      'Een eenvoudig transportmanagementsysteem voor orders, ritten, tarieven en facturatie, speciaal voor kleinere vervoerders.',
    category: 'Logistiek & Transport',
    outcomes: [
      '50% minder tijd aan administratieve verwerking per zending',
      '10% minder factuurfouten',
    ],
    tags: ['tms', 'logistics', 'workflow', 'integration', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Facturatie- en toeslagautomatisering',
    summary:
      'Een module die toeslagen, wachttijden en kilometerstaffels automatisch berekent en op de factuur zet.',
    category: 'Logistiek & Transport',
    outcomes: [
      '40% minder tijd per factuurrun',
      '20% minder discussies over toeslagen met klanten',
    ],
    tags: ['billing', 'automation', 'logistics', 'integration', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Predictive maintenance voor voertuigen',
    summary:
      'Een oplossing die kilometerstanden, sensordata en storingshistorie gebruikt om onderhoudsmomenten te voorspellen.',
    category: 'Logistiek & Transport',
    outcomes: [
      '20% minder onverwachte uitval van voertuigen',
      '10% langere gemiddelde levensduur van trucks',
    ],
    tags: ['ai', 'predictive-modeling', 'fleet-management', 'iot', 'logistics'],
    isShipped: false,
  },
  {
    title: 'Offerte- en tariefcalculator voor transport',
    summary:
      'Een calculator die op basis van afstand, laadmeters, gewicht en klantafspraken snel transportoffertes opstelt.',
    category: 'Logistiek & Transport',
    outcomes: [
      '50% minder tijd per offerte-aanvraag',
      '10% meer offertes binnen 24 uur verstuurd',
    ],
    tags: ['cpq', 'sales', 'logistics', 'automation', 'pricing'],
    isShipped: false,
  },
  {
    title: 'Servicekwaliteit KPI-dashboard',
    summary:
      'Een dashboard met on-time performance, schadeclaims en klantklachten, met drill-down per klant of route.',
    category: 'Logistiek & Transport',
    outcomes: [
      '15% minder schade- en vertragingclaims',
      "20% betere prestatie op on-time delivery KPI's",
    ],
    tags: ['dashboard', 'analytics', 'logistics', 'reporting', 'quality'],
    isShipped: false,
  },
  {
    title: 'Spraak-naar-tekst zorgrapportages',
    summary:
      'Een oplossing waarmee zorgmedewerkers observaties inspreken die automatisch worden omgezet naar dagelijkse rapportages in het ECD.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '40% minder tijd aan administratieve verslaglegging',
      '20% hogere volledigheid van rapportages',
    ],
    tags: ['ai', 'speech-to-text', 'nlp', 'healthcare', 'integration'],
    isShipped: false,
  },
  {
    title: 'AI-samenvattingen voor overdrachtsrapporten',
    summary:
      'Een LLM die alle dagrapportages bundelt en automatisch een korte overdrachts-samenvatting maakt voor de volgende dienst.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '50% minder leestijd bij dienstoverdracht',
      '10% minder gemiste bijzonderheden bij overdracht',
    ],
    tags: ['ai', 'llm', 'nlp', 'healthcare', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Rooster- en planbord voor kleinschalige zorg',
    summary:
      'Een eenvoudig planbord dat medewerkers, vrijwilligers en cliëntenplanningen combineert met beschikbaarheid en contracturen.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '20% minder roosterconflicten',
      '10% minder inzet van dure flexkrachten',
    ],
    tags: ['planning', 'hr-tech', 'healthcare', 'dashboard', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Incidentregistratie en analyse',
    summary:
      'Een systeem om incidenten en bijna-incidenten laagdrempelig te registreren en met AI te analyseren op patronen.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '30% hogere meldingsbereidheid',
      '15% minder herhaalde incidenten door gerichte verbeteracties',
    ],
    tags: ['ai', 'analytics', 'healthcare', 'compliance', 'dashboard'],
    isShipped: false,
  },
  {
    title: 'Familieportaal voor updates en communicatie',
    summary:
      "Een portaal waarin familieleden updates, foto's en rapportages kunnen zien en veilig berichten kunnen sturen met de zorg.",
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '40% minder telefoontjes en mails van familie',
      '20% hogere tevredenheid bij naasten',
    ],
    tags: [
      'portal',
      'customer-experience',
      'healthcare',
      'communication',
      'integration',
    ],
    isShipped: false,
  },
  {
    title: 'Wijkrouteplanning voor thuiszorgteams',
    summary:
      'Een routeplanner die cliëntafspraken in de wijk optimaal verdeelt over teams, rekening houdend met tijden en zorgzwaarte.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '20% minder reistijd per dienst',
      '10% meer cliëntbezoeken per dag per medewerker',
    ],
    tags: [
      'routing',
      'optimization',
      'healthcare',
      'dashboard',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'AI-check op rapportages voor inspectie-eisen',
    summary:
      'Een AI-tool die rapportages scant en aangeeft waar informatie ontbreekt met het oog op inspectie- en kwaliteitskaders.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '25% minder tekortkomingen bij interne audits',
      '30% minder tijd aan dossieraudits',
    ],
    tags: ['ai', 'nlp', 'healthcare', 'compliance', 'document-processing'],
    isShipped: false,
  },
  {
    title: 'Vrijwilligersplanning en communicatieplatform',
    summary:
      'Een klein platform om vrijwilligersdiensten te plannen, taken toe te wijzen en communicatie te centraliseren.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '30% hogere bezetting van vrijwilligerstaken',
      '50% minder losse WhatsApp-groepen voor organisatie',
    ],
    tags: ['portal', 'planning', 'communication', 'healthcare', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Zelfredzaamheid en dagstructuur app voor cliënten',
    summary:
      'Een eenvoudige app/tablet-interface die cliënten helpt met dagplanning, medicatieherinneringen en contact met zorgverleners.',
    category: 'Zorginstellingen kleinschalig',
    outcomes: [
      '15% minder ad-hoc hulpvragen in de instelling',
      '10% hogere ervaren zelfredzaamheid bij cliënten',
    ],
    tags: [
      'mobile-app',
      'healthcare',
      'reminders',
      'patient-engagement',
      'workflow',
    ],
    isShipped: false,
  },
  {
    title: 'BIM- en tekeningenzoeker voor architecten',
    summary:
      'Een slimme zoekoplossing waarmee architecten en ingenieurs tekeningen, modellen en details semantisch kunnen doorzoeken.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '40% minder tijd kwijt aan zoeken in oude projecten',
      '20% meer hergebruik van bestaande details',
    ],
    tags: ['ai', 'semantic-search', 'bim', 'construction', 'knowledge-base'],
    isShipped: false,
  },
  {
    title: 'AI-assistent voor bestemmingsplannen en regelgeving',
    summary:
      'Een LLM-assistent die bestemmingsplannen, bouwbesluiten en parkeernormen uitleest en vragen in gewone taal beantwoordt.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '50% minder tijd kwijt aan uitzoeken van lokale regels',
      '15% minder vergunningsaanvragen met ontbrekende stukken',
    ],
    tags: ['ai', 'llm', 'nlp', 'legal-tech', 'construction'],
    isShipped: false,
  },
  {
    title: 'Projectdossier portaal voor opdrachtgevers',
    summary:
      'Een portaal waar opdrachtgevers alle versies van tekeningen, rapportages, beslisdocumenten en planning kunnen volgen.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '35% minder e-mailverkeer over documenten',
      '20% minder misverstanden over actuele versies',
    ],
    tags: [
      'portal',
      'document-management',
      'construction',
      'integration',
      'workflow',
    ],
    isShipped: false,
  },
  {
    title: 'Urenregistratie en projectmarge-dashboard',
    summary:
      'Een tool voor architecten- en ingenieursbureaus om uren eenvoudig te registreren en marge per project te monitoren.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '25% hogere volledigheid in urenregistratie',
      '10% hogere gemiddelde marge door beter bijsturen',
    ],
    tags: [
      'dashboard',
      'professional-services',
      'analytics',
      'billing',
      'workflow',
    ],
    isShipped: false,
  },
  {
    title: 'Scope- en wijzigingsbeheer',
    summary:
      'Een systeem om scopewijzigingen en meer- of minderwerk in ontwerpprojecten helder vast te leggen en te laten accorderen.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '30% minder discussies over meerwerk achteraf',
      '20% sneller factureren van scopewijzigingen',
    ],
    tags: [
      'workflow',
      'e-signature',
      'construction',
      'professional-services',
      'portal',
    ],
    isShipped: false,
  },
  {
    title: '3D-ontwerpviewer voor niet-technische klanten',
    summary:
      'Een webviewer waarmee klanten 3D-modellen en varianten eenvoudig kunnen bekijken en feedback kunnen geven.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '50% minder fysieke afstemmingssessies nodig',
      '20% kortere doorlooptijd in ontwerptrajecten',
    ],
    tags: ['3d', 'viewer', 'construction', 'customer-experience', 'web-app'],
    isShipped: false,
  },
  {
    title: 'Resourceplanning voor projectteams',
    summary:
      'Een planningstool die ontwerpers en engineers over projecten verdeelt op basis van competenties en beschikbaarheid.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '15% hogere bezettingsgraad op declarabele uren',
      '20% minder overbelasting van key-medewerkers',
    ],
    tags: [
      'planning',
      'hr-tech',
      'professional-services',
      'dashboard',
      'workflow',
    ],
    isShipped: false,
  },
  {
    title: 'Automatische rapportgenerator voor adviesrapporten',
    summary:
      'Een generatieve AI die standaardonderdelen van technische adviesrapporten op basis van input en sjablonen opstelt.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '40% minder tijd aan rapportopmaak en standaardteksten',
      '10% hogere consistentie in rapportstijl',
    ],
    tags: [
      'ai',
      'generative-ai',
      'document-generation',
      'professional-services',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Versiebeheer en review workflow voor tekeningen',
    summary:
      'Een eenvoudige reviewworkflow met versiebeheer, opmerkingen en formele vrijgave van tekeningen.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '30% minder fouten door verkeerde tekenversies',
      '25% kortere reviewdoorlooptijd',
    ],
    tags: [
      'document-management',
      'workflow',
      'construction',
      'approval',
      'web-app',
    ],
    isShipped: false,
  },
  {
    title: 'AI-samenvattingen van bouwvergaderingen',
    summary:
      'Een tool die notulen automatisch genereert uit audio-opnames van bouwvergaderingen en actiepunten verdeelt.',
    category: 'Bouwgerelateerde diensten',
    outcomes: [
      '50% minder tijd aan uitwerken van notulen',
      '20% hogere opvolging van actiepunten',
    ],
    tags: ['ai', 'speech-to-text', 'nlp', 'workflow', 'construction'],
    isShipped: false,
  },
  {
    title: 'AI-voorstelgenerator voor adviesrapporten',
    summary:
      'Een LLM-tool die op basis van case-notes en vorige rapporten een eerste concept-adviesrapport opstelt dat de consultant finetunet.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '40% minder tijd aan het schrijven van standaardrapportonderdelen',
      '15% meer projecten per consultant per jaar',
    ],
    tags: [
      'ai',
      'llm',
      'generative-ai',
      'professional-services',
      'document-generation',
    ],
    isShipped: false,
  },
  {
    title: 'Sales pipeline en projectboard voor kleine bureaus',
    summary:
      'Een simpele CRM- en projectboard-oplossing waarin leads, voorstellen en lopende projecten in één flow zichtbaar zijn.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '20% hogere conversie van lead naar opdracht',
      '30% minder tijd aan statusoverzichten maken',
    ],
    tags: ['crm', 'dashboard', 'professional-services', 'workflow', 'sales'],
    isShipped: false,
  },
  {
    title: 'Tijdschrijven en facturatie-automatisering',
    summary:
      'Een systeem waarin consultants eenvoudig uren registreren die automatisch worden omgezet naar conceptfacturen volgens afspraken.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '50% minder tijd aan facturatie per maand',
      '10% hogere facturatiegraad van gemaakte uren',
    ],
    tags: [
      'billing',
      'workflow',
      'professional-services',
      'automation',
      'integration',
    ],
    isShipped: false,
  },
  {
    title: 'AI-samenvattingen van klantmeetings',
    summary:
      "Een tool die meetingopnames automatisch samenvat in beslispunten, actiepunten en risico's.",
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '60% minder tijd aan verslaglegging',
      '20% hogere kwaliteit van vastgelegde afspraken',
    ],
    tags: ['ai', 'speech-to-text', 'nlp', 'professional-services', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Klantportaal voor deliverables en voortgang',
    summary:
      'Een portaal waar klanten rapporten, dashboards en actieplannen kunnen zien en feedback kunnen geven.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '30% minder e-mailverkeer rond documentuitwisseling',
      '15% hogere klanttevredenheid op transparantie',
    ],
    tags: [
      'portal',
      'customer-experience',
      'professional-services',
      'dashboard',
      'integration',
    ],
    isShipped: false,
  },
  {
    title: 'Kennisbank met semantische zoekfunctie',
    summary:
      'Een interne kennisbank waar adviezen, templates en cases via semantische AI-zoek makkelijk terug te vinden zijn.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '35% minder tijd kwijt aan het zoeken naar oude cases',
      '20% meer hergebruik van bestaand werk',
    ],
    tags: [
      'ai',
      'semantic-search',
      'knowledge-base',
      'professional-services',
      'nlp',
    ],
    isShipped: false,
  },
  {
    title: 'NPS- en feedbacktool voor zakelijke klanten',
    summary:
      'Een tool die na elke projectfase automatisch feedback en NPS meet en insights bundelt per klant en consultant.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '25% hogere respons op klantfeedback',
      '10% stijging in NPS binnen 12 maanden',
    ],
    tags: [
      'customer-experience',
      'survey',
      'dashboard',
      'professional-services',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'Retainer KPI-dashboard voor adviesdiensten',
    summary:
      'Een dashboard dat per retainer-klant laat zien welke resultaten zijn geboekt, welke uren zijn besteed en welke acties gepland staan.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '15% hogere retentiegraad van retainer-klanten',
      '20% minder discussies over geleverde waarde',
    ],
    tags: [
      'dashboard',
      'analytics',
      'professional-services',
      'reporting',
      'integration',
    ],
    isShipped: false,
  },
  {
    title: 'Automatische rapportconversie naar management-samenvattingen',
    summary:
      'Een AI-tool die lange adviesrapporten omzet naar beknopte management-samenvattingen en presentatie-slides.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '50% minder tijd besteden aan het maken van presentaties',
      '10% hogere beslissnelheid bij klanten',
    ],
    tags: [
      'ai',
      'llm',
      'generative-ai',
      'professional-services',
      'presentation',
    ],
    isShipped: false,
  },
  {
    title: 'Lead scoring en signalering voor consultants',
    summary:
      'Een systeem dat websitebezoek, nieuwsbriefgedrag en CRM-data gebruikt om warme leads en up-sell kansen te herkennen.',
    category: 'Zakelijke Dienstverlening',
    outcomes: [
      '20% meer omzet uit bestaande klantrelaties',
      '15% meer afspraken met warme leads',
    ],
    tags: ['ai', 'analytics', 'crm', 'sales', 'professional-services'],
    isShipped: false,
  },
  {
    title: 'AI-factuurherkenning voor inkoopfacturen',
    summary:
      'Een oplossing die inkoopfacturen automatisch uitleest, boekt en koppelt aan de juiste grootboekrekening en btw-codes.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '70% minder handmatige boekingen per factuur',
      '30% minder boekingsfouten',
    ],
    tags: ['ai', 'document-processing', 'rpa', 'finance', 'automation'],
    isShipped: false,
  },
  {
    title: 'Bankkoppeling en automatische codering',
    summary:
      'Een module die bankmutaties ophaalt en met AI en regels automatisch codeert op basis van historisch gedrag.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '60% minder handmatige bankmutaties',
      '20% snellere periodeafsluiting',
    ],
    tags: ['ai', 'automation', 'finance', 'integration', 'rpa'],
    isShipped: false,
  },
  {
    title: 'Jaarrekening- en dossiervorming assistent',
    summary:
      'Een AI-assistent die ontbrekende stukken in dossiers signaleert, toelichtingen voorstelt en consistentie checks uitvoert.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '30% minder tijd voor dossiervorming per jaarrekening',
      '15% minder reviewpunten bij partnercontrole',
    ],
    tags: ['ai', 'llm', 'audit', 'document-processing', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Realtime klantdashboard met kerncijfers',
    summary:
      'Een dashboard dat omzet, marge, liquiditeit en belastingposities toont, gevoed vanuit het boekhoudpakket.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '40% minder ad-hoc rapportverzoeken van klanten',
      '20% meer adviesgesprekken op basis van cijfers',
    ],
    tags: ['dashboard', 'analytics', 'finance', 'integration', 'reporting'],
    isShipped: false,
  },
  {
    title: 'BTW- en ICP-aangifte workflow',
    summary:
      'Een workflow die btw- en ICP-aangiftes automatisch voorbereidt, afwijkingen markeert en klaarzet voor accordering.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '50% minder tijd per aangifteperiode',
      '20% minder correcties door menselijke fouten',
    ],
    tags: ['workflow', 'automation', 'finance', 'compliance', 'rpa'],
    isShipped: false,
  },
  {
    title: 'AI-klantchat over cijfers en begrippen',
    summary:
      'Een chatbot waarmee ondernemers in gewone taal vragen kunnen stellen over hun cijfers en basis fiscale begrippen.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '35% minder korte vragen via telefoon en e-mail',
      '10% hogere klanttevredenheid over uitleg en inzicht',
    ],
    tags: ['ai', 'chatbot', 'llm', 'finance', 'customer-experience'],
    isShipped: false,
  },
  {
    title: 'Advieskansen radar voor accountants',
    summary:
      'Een analytics-tool die jaarcijfers en trends scant en potentiële advieskansen signaleert zoals financiering, herstructurering of subsidie.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: ['20% meer adviesomzet per klant', '15% hogere klantretentie'],
    tags: ['ai', 'analytics', 'finance', 'crm', 'recommendation'],
    isShipped: false,
  },
  {
    title: 'Declaratie- en bonnetjes app voor ondernemers',
    summary:
      'Een mobiele app waarmee klanten bonnetjes fotograferen en laten herkennen, direct geboekt in de administratie.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '60% minder ontbrekende bonnetjes',
      '30% minder tijd aan inboeken van onkostendeclaraties',
    ],
    tags: [
      'mobile-app',
      'document-processing',
      'finance',
      'integration',
      'automation',
    ],
    isShipped: false,
  },
  {
    title: 'DMS en automatische dossiervorming',
    summary:
      'Een documentmanagementsysteem dat inkomende documenten automatisch aan het juiste klantdossier koppelt.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '50% minder tijd aan zoeken naar documenten',
      '20% minder verkeerd geclassificeerde stukken',
    ],
    tags: [
      'document-management',
      'automation',
      'finance',
      'workflow',
      'integration',
    ],
    isShipped: false,
  },
  {
    title: 'Cashflow forecasting voor mkb-klanten',
    summary:
      'Een module die op basis van openstaande posten en historische patronen cashflowprojecties voor klanten maakt.',
    category: 'Accountancy- & Administratiekantoren',
    outcomes: [
      '25% minder onverwachte liquiditeitskrapte bij klanten',
      '15% meer toegevoegde waarde als strategisch adviseur',
    ],
    tags: ['ai', 'forecasting', 'finance', 'dashboard', 'analytics'],
    isShipped: false,
  },
  {
    title: 'Offerte- en configuratietool voor zonnepanelen',
    summary:
      'Een tool waarmee adviseurs op basis van dakoppervlak, oriëntatie en verbruik snel offertes voor zonnestroom-systemen kunnen maken.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '50% minder tijd per offerte',
      '20% hogere conversie door snelle, visuele voorstellen',
    ],
    tags: ['configurator', 'energy', 'cpq', 'sales', 'web-app'],
    isShipped: false,
  },
  {
    title: 'Warmtepomp- en isolatiebesparingscalculator',
    summary:
      'Een rekenmodule die energiebesparing, CO2-reductie en terugverdientijd van maatregelen inzichtelijk maakt voor particuliere en zakelijke klanten.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '30% meer verkochte verduurzamingspakketten',
      '15% minder uitval na het eerste adviesgesprek',
    ],
    tags: ['energy', 'calculator', 'sales', 'web-app', 'analytics'],
    isShipped: false,
  },
  {
    title: 'AI-analyse van energierekeningen',
    summary:
      'Een AI-tool die historische energierekeningen inleest en automatisch besparingsadviezen en afwijkingen signaleert.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '60% minder tijd om besparingsrapporten op te stellen',
      '10% extra besparing door het vinden van foutieve tarieven',
    ],
    tags: ['ai', 'document-processing', 'energy', 'analytics', 'nlp'],
    isShipped: false,
  },
  {
    title: 'Vastgoedschouw en energie-audit app',
    summary:
      "Een inspectie-app voor energieadviseurs om per pand maatregelen en foto's vast te leggen en automatisch rapporten te genereren.",
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '50% minder tijd aan rapporteren na een schouw',
      '20% minder vergeten details in audits',
    ],
    tags: ['mobile-app', 'energy', 'reporting', 'workflow', 'field-service'],
    isShipped: false,
  },
  {
    title: 'Projectplanning voor installatieploegen',
    summary:
      'Een planbord voor installatiewerk waarbij ploegen, leveringen en kraanplanning op elkaar worden afgestemd.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '15% minder verplaatsingen door misplanning van materialen',
      '10% meer klussen per ploeg per maand',
    ],
    tags: ['planning', 'field-service', 'energy', 'dashboard', 'workflow'],
    isShipped: false,
  },
  {
    title: 'Monitoringportaal voor zonnepanelen en warmtepompen',
    summary:
      'Een portaal dat prestaties van geïnstalleerde systemen toont en storingen of afwijkingen signaleert.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '25% sneller reageren op storingen',
      '10% hogere klanttevredenheid door proactieve service',
    ],
    tags: ['iot', 'dashboard', 'energy', 'alerting', 'customer-experience'],
    isShipped: false,
  },
  {
    title: 'Subsidie- en regelingchecker met AI',
    summary:
      'Een LLM-assistent die actuele subsidieregelingen en fiscale voordelen uitleest en toepasbare regelingen per klantvoorstel toont.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '30% meer klanten die gebruikmaken van subsidies',
      '20% minder tijd aan het uitzoeken van regelingen',
    ],
    tags: ['ai', 'llm', 'nlp', 'energy', 'compliance'],
    isShipped: false,
  },
  {
    title: 'Automatische rapportgenerator voor energielabels',
    summary:
      "Een rapportagetool die invoergegevens en foto's omzet naar gestandaardiseerde energierapporten in eigen huisstijl.",
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '40% minder tijd per energielabelrapport',
      '15% hogere capaciteit aan uitgevoerde inspecties per adviseur',
    ],
    tags: [
      'automation',
      'energy',
      'document-generation',
      'reporting',
      'field-service',
    ],
    isShipped: false,
  },
  {
    title: 'Lead scoring voor verduurzamingsaanvragen',
    summary:
      'Een AI-model dat leads scoort op kans van slagen en prioriteit, op basis van type pand, investeringsbereidheid en subsidiegeschiktheid.',
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '20% hogere omzet per campagne door focus op warme leads',
      '15% minder tijd besteed aan kansarme aanvragen',
    ],
    tags: ['ai', 'analytics', 'sales', 'energy', 'crm'],
    isShipped: false,
  },
  {
    title: 'Gebouwportefeuille energie-dashboard voor vastgoedbezitters',
    summary:
      "Een dashboard voor eigenaren met meerdere panden dat energieverbruik, labels en investeringsscenario's per gebouw toont.",
    category: 'Energie, Installateurs & Duurzaamheidsadvies',
    outcomes: [
      '20% lagere energiekosten per m² binnen 3 jaar',
      '30% sneller kunnen prioriteren van investeringen',
    ],
    tags: ['dashboard', 'energy', 'analytics', 'real-estate', 'reporting'],
    isShipped: false,
  },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });
  const PROJECT_ID = 'project_klarifai';
  let created = 0,
    updated = 0;

  for (const uc of USE_CASES) {
    const sector = CATEGORY_TO_SECTOR[uc.category] ?? null;
    const existing = await db.useCase.findFirst({
      where: { projectId: PROJECT_ID, title: uc.title },
      select: { id: true },
    });

    if (existing) {
      await db.useCase.update({
        where: { id: existing.id },
        data: {
          summary: uc.summary,
          category: uc.category,
          sector,
          outcomes: uc.outcomes,
          tags: uc.tags,
          isShipped: uc.isShipped,
          isActive: true,
        },
      });
      updated++;
    } else {
      await db.useCase.create({
        data: {
          projectId: PROJECT_ID,
          title: uc.title,
          summary: uc.summary,
          category: uc.category,
          sector,
          outcomes: uc.outcomes,
          tags: uc.tags,
          caseStudyRefs: [],
          isActive: true,
          isShipped: uc.isShipped,
        },
      });
      created++;
    }
  }

  console.log(`Seed complete: ${created} created, ${updated} updated`);
  await db.$disconnect();
}

main().catch(console.error);
