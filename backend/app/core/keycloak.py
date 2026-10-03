from typing import Any, Dict

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.core.config import settings

# Keycloak JWKS client with key caching
jwks_client = PyJWKClient(settings.keycloak_jwks_url, cache_jwk_set=True, lifespan=3600)


def verify_keycloak_token(token: str) -> Dict[str, Any]:
    """
    Verifies an RS256 JWT issued by Keycloak using its OIDC certs.
    Returns the decoded token claims.
    """
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        # Note: In development/local setups, issuer URL might differ if accessed via localhost vs LAN IP
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": False,  # Keycloak access tokens often set aud to 'account'
                "verify_iss": False,  # Allow flexible local dev access (127.0.0.1 vs LAN IP)
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Keycloak token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to authenticate with Keycloak: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
