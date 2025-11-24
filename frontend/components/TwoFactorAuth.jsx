import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Copy, Check, AlertCircle, Smartphone, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import toast from 'react-hot-toast';

/**
 * Two-Factor Authentication Component
 * Supports TOTP and SMS verification
 */
const TwoFactorAuth = ({ onSetupComplete = null, onVerify = null }) => {
  const [step, setStep] = useState('method'); // method, setup, verify, recovery
  const [method, setMethod] = useState(null); // totp, sms
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Step 1: Select method
  const handleMethodSelect = (selectedMethod) => {
    setMethod(selectedMethod);
    setStep('setup');
  };

  // Step 2: Setup TOTP
  const setupTOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/2fa/setup-totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to setup TOTP');

      const data = await response.json();
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setStep('verify');
    } catch (error) {
      toast.error('Failed to setup TOTP');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Setup SMS
  const setupSMS = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/2fa/setup-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) throw new Error('Failed to setup SMS');

      toast.success('Verification code sent to your phone');
      setStep('verify');
    } catch (error) {
      toast.error('Failed to setup SMS');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify code
  const verifyCode = async () => {
    if (!verificationCode.trim()) {
      toast.error('Please enter verification code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          method,
          code: verificationCode,
          secret: method === 'totp' ? secret : undefined,
        }),
      });

      if (!response.ok) throw new Error('Invalid verification code');

      const data = await response.json();
      setRecoveryCodes(data.recoveryCodes);
      setStep('recovery');
      toast.success('2FA enabled successfully!');
    } catch (error) {
      toast.error('Invalid verification code');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Copy recovery codes
  const copyRecoveryCodes = () => {
    const text = recoveryCodes.join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Recovery codes copied to clipboard');
  };

  // Download recovery codes
  const downloadRecoveryCodes = () => {
    const element = document.createElement('a');
    const file = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'recovery-codes.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Recovery codes downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Method Selection */}
      {step === 'method' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Enable Two-Factor Authentication</h2>
          </div>

          <p className="text-muted-foreground mb-6">
            Choose how you'd like to secure your account with a second verification step.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TOTP Option */}
            <Card
              className="p-6 cursor-pointer border-2 hover:border-primary transition-colors"
              onClick={() => handleMethodSelect('totp')}
            >
              <Smartphone className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Authenticator App</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use an app like Google Authenticator or Authy to generate codes
              </p>
              <Button className="w-full">Select</Button>
            </Card>

            {/* SMS Option */}
            <Card
              className="p-6 cursor-pointer border-2 hover:border-primary transition-colors"
              onClick={() => handleMethodSelect('sms')}
            >
              <MessageSquare className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-2">SMS Text Message</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Receive verification codes via text message to your phone
              </p>
              <Button className="w-full">Select</Button>
            </Card>
          </div>
        </motion.div>
      )}

      {/* TOTP Setup */}
      {step === 'setup' && method === 'totp' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Setup Authenticator App</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Scan this QR code with your authenticator app or enter the code manually.
            </p>

            <Button
              onClick={setupTOTP}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </Button>
          </Card>
        </motion.div>
      )}

      {/* SMS Setup */}
      {step === 'setup' && method === 'sms' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Setup SMS Verification</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your phone number to receive verification codes via SMS.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Button
                onClick={setupSMS}
                disabled={loading || !phoneNumber}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Verification */}
      {step === 'verify' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Verify Your Code</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Enter the {method === 'totp' ? '6-digit code from your authenticator app' : 'code sent to your phone'}.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength="6"
                  className="mt-2 text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                onClick={verifyCode}
                disabled={loading || verificationCode.length !== 6}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Recovery Codes */}
      {step === 'recovery' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <Card className="p-6 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">Save Your Recovery Codes</h3>
                <p className="text-sm text-amber-800 mt-1">
                  Keep these codes in a safe place. You can use them to access your account if you lose access to your 2FA method.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="bg-muted p-4 rounded-lg mb-4 font-mono text-sm space-y-2">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="text-foreground">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={copyRecoveryCodes}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                onClick={downloadRecoveryCodes}
                variant="outline"
                className="flex-1"
              >
                Download
              </Button>
            </div>
          </Card>

          <Button
            onClick={() => {
              setStep('method');
              onSetupComplete?.();
            }}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Setup Complete
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default TwoFactorAuth;
