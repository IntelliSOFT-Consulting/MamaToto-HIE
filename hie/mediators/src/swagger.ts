import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MamaToto Mediators API',
      version: '1.0.0',
      description: 'MamaToto HIE Mediators for Beneficiary Enrollment & Maternal Hybrid Care Model',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
      {
        url: 'https://openhim-core-mamatoto.intellisoftkenya.com',
      },
      {
        url: 'https://openhim-core.mamatoto.pharmaccess.io',
      }
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API routes and controllers
};

const swaggerSpec = swaggerJSDoc(options);

// export function setupSwagger(app: Express) {
//   // Swagger page
//   app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//   // Docs in JSON format
//   app.get('/docs.json', (req, res) => {
//     res.setHeader('Content-Type', 'application/json');
//     res.send(swaggerSpec);
//   });
// }