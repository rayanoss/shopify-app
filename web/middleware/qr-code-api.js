import { Shopify } from "@shopify/shopify-api";
import { QRCodesDB } from "../qr-codes-db.js";
import {
  getQrCodeOr404,
  getShopUrlFromSession,
  parseQrCodeBody,
  formatQrCodeResponse,
} from "../helpers/qr-codes.js";

const DISCOUNTS_QUERY = `
  query discounts($first: Int!) {
    codeDiscountNodes(first: $first) {
      edges {
        node {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              codes(first: 1) {
                edges {
                  node {
                    code
                  }
                }
              }
            }
            ... on DiscountCodeBxgy {
              codes(first: 1) {
                edges {
                  node {
                    code
                  }
                }
              }
            }
            ... on DiscountCodeFreeShipping {
              codes(first: 1) {
                edges {
                  node {
                    code
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export default function applyQrCodeApiEndpoints(app){
    app.get("/api/discounts", async (req, res) => {
        const session = await Shopify.Utils.loadCurrentSession(
            req, 
            res, 
            app.get("use-online-tokens")
        ); 

        if(!session){
            res.status(401).send("Could not find a Shopify session"); 
            return; 
        }

        const client = new Shopify.Clients.Graphql(
            session.shop, 
            session.accessToken
        ); 

        const discounts = await client.query({
            data: {
                query: DISCOUNTS_QUERY, 
                variables: {
                    fist: 25, 
                }, 
            }, 
        }); 
        res.send(discounts.body.data); 
    }); 

    app.post("/api/qrcodes", async (req, res) => {
        try{
            const id = await QRCodesDB.create({
                ...(await parseQrCodeBody(req)), 
                shopDomain: await getShopUrlFromSession(req, res), 
            }); 
            const response = await formatQrCodeResponse(req, res, [
                await QRCodesDB.read(id), 
            ]); 
            res.status(201).send(response[0]); 
        }catch (error){
            res.status(500).send(error.message); 
        }
    }); 

    app.patch("/api/qrcodes/:id", async (req, res) => {
        const qrcode = await getQrCodeOr404(req, res); 

        if (qrcode) {
            try {
                await QRCodesDB.update(req.params.id, await parseQrCodeBody(req)); 
                const response = await formatQrCodeResponse(req, res, [
                    await QRCodesDB.read(req.params.id), 
                ]); 
                res.status(200).send(response[0]); 
            } catch (error) {
                res.status(500).send(error.message); 
            }
        }
    }); 

    app.get("/api/qrcodes", async (req, res) => {
        try{
            const rawCodeData = await QRCodesDB.list(
                await getShopUrlFromSession(req, res)
            ); 

            const response = await formatQrCodeResponse(req, res, rawCodeData); 
            res.status(200).send(response); 
        } catch (error) {
            console.error(error); 
            res.statsu(500).send(error.message) ;
        }
    }); 

    app.get("/api/qrcodes/:id", async (req, res) => {
        const qrcode = await getQrCodeOr404(req, res);
    
        if (qrcode) {
          const formattedQrCode = await formatQrCodeResponse(req, res, [qrcode]);
          res.status(200).send(formattedQrCode[0]);
        }
      });
    
      app.delete("/api/qrcodes/:id", async (req, res) => {
        const qrcode = await getQrCodeOr404(req, res);
    
        if (qrcode) {
          await QRCodesDB.delete(req.params.id);
          res.status(200).send();
        }
      });
}