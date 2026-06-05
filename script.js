import { Model } from './js/model.js';
import { View } from './js/view.js';
import { Controller } from './js/controller.js';

// Inicialização da aplicação após o carregamento completo do DOM
document.addEventListener('DOMContentLoaded', () => {
    const model = new Model();
    const view = new View();
    const controller = new Controller(model, view);

    // Exporta a instância para o escopo global apenas para fins de depuração e testes
    window.app = { model, view, controller };
});
