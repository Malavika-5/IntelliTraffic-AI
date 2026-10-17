import urllib.request
import json

def run():
    # 1. Login as patient
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/auth/login',
        data=json.dumps({'email': 'patient@demo.local', 'password': 'Demo@1234'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        auth_data = json.loads(resp.read().decode())
        token = auth_data['access_token']
        user = auth_data['user']
        print('Logged in user:', user['email'])
        print('User emergency contact phone:', user.get('emergency_contact_phone'))

    # 2. Create emergency booking without explicitly overriding contact
    # (should inherit the user's emergency contact given on login/profile)
    booking_payload = {
        'booking_type': 'emergency',
        'requested_category': 'basic',
        'pickup_latitude': 9.9312,
        'pickup_longitude': 76.2673,
        'pickup_address': 'Marine Drive Promenade, Kochi',
        'patient_name': 'Priya Nair',
        'contact_phone': '+919876543210'
    }
    req2 = urllib.request.Request(
        'http://127.0.0.1:8000/api/bookings',
        data=json.dumps(booking_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req2) as resp2:
        b_data = json.loads(resp2.read().decode())
        print('\nBooking Created:')
        print('  ID:', b_data['id'])
        print('  Ref:', b_data['reference_number'])
        print('  Emergency Contact Notified:', b_data['emergency_contact_notified'])
        print('  Emergency Contact Phone:', b_data['emergency_contact_phone'])
        print('  Emergency Contact Name:', b_data['emergency_contact_name'])
        print('  SMS Message Preview:', b_data['emergency_contact_message'].encode('ascii', 'replace').decode('ascii'))
        booking_id = b_data['id']

    # 3. Resend alert with a custom phone
    req3 = urllib.request.Request(
        f'http://127.0.0.1:8000/api/bookings/{booking_id}/resend-emergency-alert?custom_phone=%2B919876511111',
        data=b'',
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req3) as resp3:
        b_resend = json.loads(resp3.read().decode())
        print('\nAlert Resent:')
        print('  Updated Emergency Phone:', b_resend['emergency_contact_phone'])
        print('  Emergency Notified:', b_resend['emergency_contact_notified'])

if __name__ == '__main__':
    run()
