// NumeroClientGenerator.js

import { createHash } from 'crypto';

class NumeroClientGenerator {
    constructor() {}

    // Fonction pour générer un numéro de client aléatoire
    genererNumeroClient() {
        const randomNumber = Math.floor(Math.random() * 1000) + 1;
        const hash = createHash('sha256');
        hash.update(randomNumber.toString());
        const numeroClient = 'C' + hash.digest('hex').substring(0, 3).toUpperCase();
        return numeroClient;
    }

    // Fonction pour vérifier si un numéro de client est unique
    verifierNumeroClientUnique(numeroClient) {
        // Implémentez votre logique de vérification d'unicité ici
        return true; // Pour l'exemple, toujours considéré comme unique
    }

    // Fonction pour générer un numéro de client unique
    genererNumeroClientUnique() {
        let numeroClient;
        do {
            numeroClient = this.genererNumeroClient();
        } while (!this.verifierNumeroClientUnique(numeroClient));
        return numeroClient;
    }
}

export default NumeroClientGenerator;
