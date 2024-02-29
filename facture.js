import { input } from '@inquirer/prompts';
import { MongoClient } from 'mongodb';

import fs from 'fs';
import path from 'path';

import { genererFacturePDF } from './utils/pdfUtils.js';

//Données globales
const COMPANY_NAME = "Simply'Vie";


function obtenirDateDuJour() {
    const date = new Date();
    const jour = String(date.getDate()).padStart(2, '0'); // Jour du mois (ajout de zéro au début si nécessaire)
    const mois = String(date.getMonth() + 1).padStart(2, '0'); // Mois (ajout de zéro au début si nécessaire)
    const annee = date.getFullYear(); // Année

    return `${jour}/${mois}/${annee}`;
}
const dateDuJour = obtenirDateDuJour();

function creerNumeroFactures() {
    const dossierFactures = 'factures';
    // Vérifier si le dossier "factures" existe, sinon le créer
    if (!fs.existsSync(dossierFactures)) {
        fs.mkdirSync(dossierFactures);
    }

    const dossierLength = fs.readdirSync(dossierFactures).length;//pas +1 car le dossier /pdf compte pour un élément
    const createNumero = dossierLength.toString().padStart(3, '0');
    return createNumero;
}

async function findCompany(db, companyName) {
    const companyData = db.collection('entreprise').findOne({ companyName });
    return companyData;
}


// Fonction pour connexion à la base de données
async function connectToMongoDB() {
    const uri = 'mongodb+srv://bosc8088:L5DdR8qm50pONP0W@cluster0.7lfstrh.mongodb.net/';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('Connecté à la base de données MongoDB');
        return client.db('factures-app');
    } catch (error) {
        console.error('Erreur de connexion à MongoDB:', error);
        process.exit(1);
    }
}

// Fonction pour rechercher le client dans la base de données
async function findCustomer(db, customer_lastname_to_fetch, customer_firstname_to_fetch) {
    const dataFromLastName = db.collection('data-for-factures').findOne({ customer_lastname: customer_lastname_to_fetch });
    if (dataFromLastName) {

        return dataFromLastName
    } else {
        console.log('Client non trouvé');
    }
}

const verifyFirstname = (customer_firstname, customerData) => {
    return customerData.customer_firstname.includes(customer_firstname)
}

//Fonction pour générer facture en HTML
async function genererFactureHTML(customer, datesInterventions, nombreInterventions, company) {

    //collecter données
    //générer numéro de facture
    const numeroFacture = creerNumeroFactures();
    //noms et adresse des clients
    const arrayOfFirstnames = customer.customer_firstname.map((mot) => {
        // Mettre en majuscule la première lettre de chaque mot et concaténer avec le reste du mot en minuscules
        return mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase();
    });
    const firstname = arrayOfFirstnames.join(', ').replace(/,([^,]*)$/, ' et$1')
    const lastname = customer.customer_lastname.charAt(0).toUpperCase() + customer.customer_lastname.slice(1).toLowerCase()
    const customer_address = customer.customer_address

    //prestations
    const prestations = customer.prestations;

    const tbodyContent = prestations.map((prestation) => {
        const interventionsToInvoiceArray = prestation.interventions.filter(objet => !objet.invoiced);
        //console.log(interventionsToInvoiceArray);
        const interventionDates = interventionsToInvoiceArray.map((intervention) => {
            const options = { year: 'numeric', month: 'numeric', day: 'numeric' }
            //console.log( intervention.date.toLocaleDateString('fr-FR', options));
            const formattedDates = intervention.date.toLocaleDateString('fr-FR', options);
            let objInfos = {
                dates: formattedDates,
                coef: parseInt(intervention.qty_unit)
            };
            let interventionInfos = new Map(Object.entries(objInfos));
            // console.log('infos of Map '+ interventionInfos.get('dates') + ' : ' + interventionInfos.get('coef'));
            return interventionInfos;
        })
        let qtyArray = [];


        let ul = interventionDates.map((i) => {
            qtyArray.push(i.get('coef'));
            console.log('qty array :' + qtyArray);
            console.log('infos of Map ' + i.get('dates') + " : " + i.get('coef'));
            return `<span>
                     ${i.get('dates')} ${i.get('coef')} ${prestation.unit_type}${i.get('coef') > 1 ? 's' : ''}
                 </span>`
        })

        const qty = qtyArray.reduce((accumulator, n) => accumulator + n)
        console.log('qty ' + qty);
        console.log('ul ' + ul);

        return `
            <tr>
                <td>${prestation.description}</br> 
                    <ul>${ul}</ul>
                </td>
                <td class="qty">${qty}</td>
                <td class="unit_price">${prestation.unit_price} €</td>
                <td class="total_per_line">${(qty * prestation.unit_price).toFixed(2)} €</td>
            </tr>
        `;
    }).join('');

    const bankInfos = `
    <table>
        <th>Nos coordonnées pour tout règlement :</th>
        <tr>
            <td>titulaire du compte :${company.banques[0].titulaireName} </td>  
        </tr>
        <tr>
            <td>adresse du titulaire du compte :${company.banques[0].adressTitulaire} </td>  
        </tr>
        <tr>
            <td>IBAN :${company.banques[0].iban} BIC:${company.banques[0].bic} </td> 
        </tr>
        <tr> 
            <td>domiciliation :${company.banques[0].domiciliation} </td>            
        </tr>
    </table>
`

    try {

        // Chemin de l'image
        const cheminImage = './docs/logo.png';

        // Lire le contenu de l'image
        const data = await fs.promises.readFile(cheminImage);

        // Convertir les données de l'image en base64
        const imgData = Buffer.from(data).toString('base64');

        // Lire modèle de facture
        const modeleFacture = await fs.promises.readFile('./docs/modele-facture.html', 'utf-8');

        // console.log(imgData);

        const factureHTML = modeleFacture
            .replace(/{{imgData}}/g, imgData)
            .replace(/{{date}}/g, `${dateDuJour}`)
            .replace(/{{facture}}/g, `FA-${numeroFacture}`)
            .replace(/{{company.companyName}}/g, `${company.companyName}`)
            .replace(/{{company.siret}}/g, `${company.siret}`)
            .replace(/{{company.rna}}/g, `${company.rna}`)
            .replace(/{{company.ape}}/g, `${company.ape}`)
            .replace(/{{company.adress}}/g, `${company.adress}`)
            .replace(/{{company.cp}}/g, `${company.cp}`)
            .replace(/{{company.city}}/g, `${company.city}`)
            .replace(/{{company.telephone}}/g, `${company.contact.telephone1}`)
            .replace(/{{company.email}}/g, `${company.contact.email}`)
            .replace(/{{company.web}}/g, `${company.contact.web}`)
            .replace(/{{client.nom}}/g, `${firstname} ${lastname}`)
            .replace(/{{client.numero}}/g, `${'C' + customer.customer_number.toString().padStart(3, '0')}`)
            .replace(/{{client.rue}}/g, `${customer_address.number} ${customer_address.road}`)
            .replace(/{{client.cp}}/g, `${customer_address.postal_code}`)
            .replace(/{{client.ville}}/g, `${customer_address.city}`)
            .replace(/{{datesInterventions}}/g, datesInterventions)
            .replace(/{{nombreInterventions}}/g, nombreInterventions)
            .replace(/{{tbodyContent}}/g, tbodyContent)
            .replace(/{{mention-tva}}/g, `${company.mentionTva}`)
            .replace(/{{taux-tva}}/g, `0`)
            .replace(/{{tva}}/g, `0`)
            .replace(/{{bank-infos}}/g, bankInfos);


        //console.log(`${factureHTML}`);
        return factureHTML;
    } catch (error) {
        console.error('Erreur lors de la lecture du modèle de facture:', error);
        return null;
    }
}

//fonction pour écrire la facture dans un dossier
function ecrireFacture(factureHTML) {
    const dossierFacturesHTML = 'factures';
    const dossierFacturesPDF = 'factures/pdf';

    // Vérifier si le dossier "factures" existe, sinon le créer
    if (!fs.existsSync(dossierFacturesHTML)) {
        fs.mkdirSync(dossierFacturesHTML);
    }
    if (!fs.existsSync(dossierFacturesPDF)) {
        fs.mkdirSync(dossierFacturesPDF);
    }

    // Compter le nombre de fichiers de facture existants dans le dossier "factures"
    const numeroFacture = creerNumeroFactures();
    const nomFichierFactureHTML = `FA-${numeroFacture}.html`;
    const cheminFichierFactureHTML = path.join(dossierFacturesHTML, nomFichierFactureHTML);
    const nomFichierFacturePDF = `FA-${numeroFacture}.pdf`;
    const cheminFichierFacturePDF = path.join(dossierFacturesPDF, nomFichierFacturePDF);

    // Écrire le fichier de facture
    fs.writeFileSync(cheminFichierFactureHTML, factureHTML);
    genererFacturePDF(factureHTML, cheminFichierFacturePDF);

    console.log(`La facture a été créée avec succès : ${nomFichierFactureHTML} et ${nomFichierFacturePDF}`);
}


// Fonction principale
async function main() {
    const db = await connectToMongoDB();
    const customer_firstname_to_fetch = await input({ message: 'Enter customer\'s frstname' });
    const customer_lastname_to_fetch = await input({ message: 'Enter customer\'s lastname' });
    const customer = await findCustomer(db, customer_lastname_to_fetch);
    console.log('company name :' + COMPANY_NAME);
    const company = await findCompany(db, COMPANY_NAME);



    if (customer && verifyFirstname(customer_firstname_to_fetch, customer)) {

        const datesInterventions = "01/02/2024, 02/02/2024, 03/02/2024";
        const nombreInterventions = 3;

        genererFactureHTML(customer, datesInterventions, nombreInterventions, company)
            .then((contenuHTML) => {
                if (contenuHTML) {
                    // console.log('Contenu du modèle de facture :', contenuHTML);
                    ecrireFacture(contenuHTML)
                } else {
                    console.log('Le contenu du modèle de facture est vide.');
                }
            })
            .catch((error) => {
                console.error('Erreur lors de la lecture du modèle de facture:', error);
            });

    } else {
        console.log('Client non trouvé');
    }




    //process.exit(0);
}


main();