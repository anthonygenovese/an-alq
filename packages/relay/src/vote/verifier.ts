export interface VoteProof {
  /** Public inputs. The recipient address is not one of them. */
  alertKey: string;
  nullifier: string;
  provenDate: string;
  dkimDomain: string;
  selector: string;
  /** Opaque proof bytes. Empty for the scaffold. */
  bytes: string;
}

export type VerifyResult =
  { ok: true } | { ok: false; reason: "zk_verifier_not_deployed" | "malformed_proof" };

/**
 * Server-side checker for a browser-generated DKIM receipt proof.
 * The scaffold does not accept a proof as valid. A later PR links a real verifier.
 */
export interface ProofVerifier {
  readonly implementation: "scaffold" | "zk-email";
  verify(proof: VoteProof): VerifyResult;
}

export class ScaffoldProofVerifier implements ProofVerifier {
  readonly implementation = "scaffold" as const;

  verify(proof: VoteProof): VerifyResult {
    if (!proof.alertKey || !proof.nullifier || !proof.provenDate || !proof.dkimDomain) {
      return { ok: false, reason: "malformed_proof" };
    }
    return { ok: false, reason: "zk_verifier_not_deployed" };
  }
}

/**
 * DNS names observed 2026-11-21. The key material is not copied into the repo.
 * A live alert was not available here, so the selector on a given message
 * still has to be read from that message's DKIM-Signature.
 */
export const NIXLE_DKIM = {
  observed: "2026-11-21",
  domain: "nixle.com",
  selectors: [
    {
      name: "selector2",
      dns: "selector2._domainkey.nixle.com",
      cname: "selector2-nixle-com._domainkey.everbridge.onmicrosoft.com",
      key: "DKIM1 RSA present",
    },
    {
      name: "nixle",
      dns: "nixle._domainkey.nixle.com",
      cname: "nixle.drs3em.custdkim.salesforce.com",
      key: "DKIM1 RSA present",
    },
  ],
  mx: "Google (aspmx.l.google.com and alt)",
  spfIncludes: ["amazonses.com", "_spf.google.com", "mail.zendesk.com"],
  sampleMessageChecked: false,
} as const;
