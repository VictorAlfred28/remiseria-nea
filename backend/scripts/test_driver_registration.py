#!/usr/bin/env python3
"""
Script de testing para el endpoint POST /api/v1/public/registro/chofer

Uso:
    python test_driver_registration.py --url http://localhost:8000 --org-id <uuid>
"""

import requests
import json
import sys
import argparse
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Optional

# ANSI Color codes
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_test(name: str, passed: bool, details: str = ""):
    """Print test result with colors"""
    status = f"{Colors.GREEN}✓ PASS{Colors.END}" if passed else f"{Colors.RED}✗ FAIL{Colors.END}"
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")


def print_response(response: requests.Response):
    """Pretty print response"""
    print(f"  Status: {response.status_code}")
    try:
        print(f"  Body: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"  Body: {response.text[:200]}")


class DriverRegistrationTester:
    def __init__(self, base_url: str, org_id: str):
        self.base_url = base_url.rstrip('/')
        self.org_id = org_id
        self.endpoint = f"{self.base_url}/api/v1/public/registro/chofer"
        self.test_count = 0
        self.passed_count = 0
        self.failed_tests = []
    
    def make_request(self, payload: Dict[str, Any]) -> requests.Response:
        """Make POST request to endpoint"""
        headers = {"Content-Type": "application/json"}
        return requests.post(self.endpoint, json=payload, headers=headers)
    
    def valid_request(self) -> Dict[str, Any]:
        """Generate a valid request payload"""
        return {
            "nombre": f"Juan Pérez {uuid4().hex[:4]}",
            "email": f"test.{uuid4().hex[:8]}@example.com",
            "telefono": "1123456789",
            "dni": f"DNI{uuid4().hex[:8]}",
            "organizacion_id": self.org_id,
            "direccion": "Calle Principal 123, CABA",
            "licencia_numero": f"LIC{uuid4().hex[:4]}",
            "licencia_categoria": "B",
            "licencia_vencimiento": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
            "tiene_vehiculo": False,
            "documentos": [],
            "tipo_pago": "comision",
            "valor_pago": 0.0
        }
    
    def run_test(self, name: str, payload: Dict[str, Any], 
                 expected_status: int, expected_detail_substring: Optional[str] = None) -> bool:
        """Run a single test"""
        self.test_count += 1
        print(f"\n{Colors.BLUE}Test {self.test_count}: {name}{Colors.END}")
        
        try:
            response = self.make_request(payload)
            passed = response.status_code == expected_status
            
            if expected_detail_substring and response.status_code >= 400:
                response_data = response.json()
                detail = response_data.get("detail", "")
                passed = passed and expected_detail_substring in detail
            
            if passed:
                self.passed_count += 1
                print_test(name, True)
            else:
                self.failed_tests.append(name)
                print_test(name, False, f"Expected {expected_status}, got {response.status_code}")
            
            print_response(response)
            return passed
            
        except Exception as e:
            self.failed_tests.append(name)
            print_test(name, False, f"Exception: {str(e)}")
            return False
    
    def test_valid_request(self):
        """Test 1: Valid request should succeed"""
        payload = self.valid_request()
        self.run_test(
            "Valid registration (no vehicle)",
            payload,
            expected_status=200
        )
    
    def test_valid_request_with_vehicle(self):
        """Test 2: Valid request with vehicle"""
        payload = self.valid_request()
        payload["tiene_vehiculo"] = True
        payload["vehiculo"] = "Toyota Corolla 2020"
        payload["patente"] = "ABC1234"
        
        self.run_test(
            "Valid registration (with vehicle)",
            payload,
            expected_status=200
        )
    
    def test_invalid_email_format(self):
        """Test 3: Invalid email format"""
        payload = self.valid_request()
        payload["email"] = "invalid-email"
        
        # Note: Pydantic will reject this with 422, not 400
        self.run_test(
            "Invalid email format (Pydantic validation)",
            payload,
            expected_status=422
        )
    
    def test_missing_required_field(self):
        """Test 4: Missing required field"""
        payload = self.valid_request()
        del payload["telefono"]  # Required field
        
        # Pydantic will reject this with 422
        self.run_test(
            "Missing required field 'telefono'",
            payload,
            expected_status=422
        )
    
    def test_invalid_phone_format(self):
        """Test 5: Invalid phone format (< 10 digits)"""
        payload = self.valid_request()
        payload["telefono"] = "123"
        
        self.run_test(
            "Invalid phone format (too short)",
            payload,
            expected_status=400,
            expected_detail_substring="Teléfono inválido"
        )
    
    def test_expired_license(self):
        """Test 6: Expired license"""
        payload = self.valid_request()
        payload["licencia_vencimiento"] = "2020-01-01"
        
        self.run_test(
            "Expired license",
            payload,
            expected_status=400,
            expected_detail_substring="Licencia vencida"
        )
    
    def test_invalid_license_date_format(self):
        """Test 7: Invalid license date format"""
        payload = self.valid_request()
        payload["licencia_vencimiento"] = "01-01-2026"  # Wrong format
        
        self.run_test(
            "Invalid license date format",
            payload,
            expected_status=400,
            expected_detail_substring="Formato de fecha licencia inválido"
        )
    
    def test_vehicle_without_plate(self):
        """Test 8: Vehicle without plate"""
        payload = self.valid_request()
        payload["tiene_vehiculo"] = True
        payload["vehiculo"] = "Toyota Corolla"
        # Missing patente
        
        self.run_test(
            "Vehicle without plate",
            payload,
            expected_status=400,
            expected_detail_substring="Patente es requerida"
        )
    
    def test_invalid_plate_format(self):
        """Test 9: Invalid plate format (too short)"""
        payload = self.valid_request()
        payload["tiene_vehiculo"] = True
        payload["vehiculo"] = "Toyota Corolla"
        payload["patente"] = "AB"  # Too short (needs 6-8)
        
        self.run_test(
            "Invalid plate format (too short)",
            payload,
            expected_status=400,
            expected_detail_substring="Patente inválida"
        )
    
    def test_invalid_plate_format_long(self):
        """Test 10: Invalid plate format (too long)"""
        payload = self.valid_request()
        payload["tiene_vehiculo"] = True
        payload["vehiculo"] = "Toyota Corolla"
        payload["patente"] = "ABCDEFGHIJ"  # Too long
        
        self.run_test(
            "Invalid plate format (too long)",
            payload,
            expected_status=400,
            expected_detail_substring="Patente inválida"
        )
    
    def test_invalid_organization(self):
        """Test 11: Invalid organization ID"""
        payload = self.valid_request()
        payload["organizacion_id"] = "00000000-0000-0000-0000-000000000000"
        
        self.run_test(
            "Invalid organization ID",
            payload,
            expected_status=400,
            expected_detail_substring="Organización"
        )
    
    def test_duplicate_email(self):
        """Test 12: Duplicate email (needs to be run after Test 1)"""
        # First create a valid driver
        payload1 = self.valid_request()
        email = payload1["email"]
        
        response1 = self.make_request(payload1)
        if response1.status_code != 200:
            print(f"  {Colors.YELLOW}⊘ SKIP: Couldn't create first driver{Colors.END}")
            return
        
        # Try to create another with same email
        payload2 = self.valid_request()
        payload2["email"] = email
        
        self.run_test(
            "Duplicate email in same organization",
            payload2,
            expected_status=400,
            expected_detail_substring="Email ya registrado"
        )
    
    def test_duplicate_dni(self):
        """Test 13: Duplicate DNI"""
        # First create a valid driver
        payload1 = self.valid_request()
        dni = payload1["dni"]
        
        response1 = self.make_request(payload1)
        if response1.status_code != 200:
            print(f"  {Colors.YELLOW}⊘ SKIP: Couldn't create first driver{Colors.END}")
            return
        
        # Try to create another with same DNI
        payload2 = self.valid_request()
        payload2["dni"] = dni
        
        self.run_test(
            "Duplicate DNI in same organization",
            payload2,
            expected_status=400,
            expected_detail_substring="DNI ya registrado"
        )
    
    def run_all_tests(self):
        """Run all tests"""
        print(f"\n{Colors.BOLD}=== DRIVER REGISTRATION TESTS ==={Colors.END}")
        print(f"Endpoint: {self.endpoint}")
        print(f"Organization ID: {self.org_id}\n")
        
        self.test_valid_request()
        self.test_valid_request_with_vehicle()
        self.test_invalid_email_format()
        self.test_missing_required_field()
        self.test_invalid_phone_format()
        self.test_expired_license()
        self.test_invalid_license_date_format()
        self.test_vehicle_without_plate()
        self.test_invalid_plate_format()
        self.test_invalid_plate_format_long()
        self.test_invalid_organization()
        self.test_duplicate_email()
        self.test_duplicate_dni()
        
        # Print summary
        print(f"\n{Colors.BOLD}=== TEST SUMMARY ==={Colors.END}")
        print(f"Total: {self.test_count}")
        print(f"{Colors.GREEN}Passed: {self.passed_count}{Colors.END}")
        print(f"{Colors.RED}Failed: {len(self.failed_tests)}{Colors.END}")
        
        if self.failed_tests:
            print(f"\n{Colors.RED}Failed tests:{Colors.END}")
            for test_name in self.failed_tests:
                print(f"  - {test_name}")
        
        return len(self.failed_tests) == 0


def main():
    parser = argparse.ArgumentParser(
        description="Test driver registration endpoint"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base URL of the API (default: http://localhost:8000)"
    )
    parser.add_argument(
        "--org-id",
        required=True,
        help="Organization ID to use for tests"
    )
    
    args = parser.parse_args()
    
    tester = DriverRegistrationTester(args.url, args.org_id)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
